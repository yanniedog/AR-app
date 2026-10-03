import { Linking } from 'react-native';

import { StandardUrl } from './standardUrl';
import { trustedExternalUrl, type TrustedExternalUrlPurpose, type TrustedExternalUrlRequest } from './trustedExternalUrl';

export interface ExternalLinkAuditCheck {
  status: 'pass' | 'fail' | 'unknown';
  detail: string;
  attempted: boolean;
}

export interface ExternalLinkAuditResult {
  label: string;
  purpose: TrustedExternalUrlPurpose;
  /** Rejected destinations are deliberately not recorded in diagnostics. */
  host: string | null;
  /** Path only: query values and fragments never enter the audit report. */
  path: string | null;
  validation: ExternalLinkAuditCheck;
  handler: ExternalLinkAuditCheck;
  reachability: ExternalLinkAuditCheck;
  httpStatus: number | null;
}

export interface ExternalLinkAuditOptions {
  reachability: boolean;
  handler?: boolean;
  platform: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  canOpenUrl?: (url: string) => Promise<boolean>;
  fetch?: typeof globalThis.fetch;
}

const check = (status: ExternalLinkAuditCheck['status'], detail: string, attempted = true): ExternalLinkAuditCheck => ({ status, detail, attempted });

/** A race is necessary because some native APIs do not settle after abort. */
async function bounded<T>(action: (signal: AbortSignal) => Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    return await Promise.race([
      new Promise<T>((_, reject) => {
        onAbort = () => {
          controller.abort();
          reject(new Error('cancelled'));
        };
        if (signal?.aborted) onAbort();
        else signal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('timeout'));
        }, timeoutMs);
      }),
      Promise.resolve().then(() => {
        if (controller.signal.aborted) throw new Error('cancelled');
        return action(controller.signal);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  }
}

/** Checks destination policy, OS handling and HTTP separately; never launches a browser. */
export async function auditExternalLink(
  request: TrustedExternalUrlRequest,
  options: ExternalLinkAuditOptions,
): Promise<ExternalLinkAuditResult> {
  const result: ExternalLinkAuditResult = {
    label: request.label,
    purpose: request.purpose,
    host: null,
    path: null,
    validation: check('unknown', 'Destination validation has not completed.', false),
    handler: check('unknown', 'Browser handling was not checked.', false),
    reachability: check('unknown', options.reachability ? 'The website has not been checked.' : 'HTTP reachability was not tested in this audit mode or within its time budget.', false),
    httpStatus: null,
  };
  let trusted: ReturnType<typeof trustedExternalUrl>;
  try {
    trusted = trustedExternalUrl(request);
  } catch {
    result.validation = check('fail', 'Destination validation failed on this runtime.');
    return result;
  }
  if (!trusted.ok) {
    result.validation = check('fail', trusted.message);
    return result;
  }
  result.validation = check('pass', 'Approved, credential-free HTTPS destination.');
  result.host = trusted.host;
  result.path = new StandardUrl(trusted.url).pathname;
  if (options.signal?.aborted) return result;
  const timeoutMs = Math.min(15_000, Math.max(1, options.timeoutMs ?? 5_000));
  const handler = options.handler === false
    ? Promise.resolve().then(() => {
      result.handler = check('unknown', 'The installed browser handler was not checked within the audit time budget.', false);
    })
    : options.platform === 'web'
    ? Promise.resolve().then(() => {
      // RN-web's canOpenURL unconditionally returns true; it is not evidence
      // that a browser will allow a popup or an external application.
      result.handler = check('unknown', 'Browser handling requires an explicit user tap on web.', false);
    })
    : bounded(() => (options.canOpenUrl ?? ((url: string) => Linking.canOpenURL(url)))(trusted.url), timeoutMs, options.signal)
      .then((available) => {
        result.handler = available
          ? check('pass', 'The operating system reports an installed handler for this destination.')
          : check('fail', 'The operating system could not find a handler for this destination.');
      })
      .catch(() => { result.handler = check('unknown', 'The installed browser handler could not be verified.'); });
  const network = !options.reachability
    ? Promise.resolve()
    : bounded((signal) => (options.fetch ?? globalThis.fetch)(trusted.url, {
      method: 'HEAD',
      redirect: 'manual',
      credentials: 'omit',
      cache: 'no-store',
      signal,
    }), timeoutMs, options.signal)
      .then((response) => {
        result.httpStatus = response.status;
        if (!response.status || (response.status >= 300 && response.status < 400)) {
          result.reachability = check('unknown', 'The source redirected or hid its response; the destination was not confirmed.');
          return;
        }
        // Native fetch may follow redirects even when manual was requested.
        // The transport guard also validates the final destination; check again
        // here so a standalone checker can never bless an unsafe final URL.
        if (!response.url) {
          result.reachability = check('unknown', 'HTTP responded without a final destination; reachability was not confirmed.');
          return;
        }
        const final = trustedExternalUrl({ ...request, url: response.url });
        if (!final.ok) {
          result.reachability = check('fail', 'The response destination does not satisfy the approved source policy.');
          return;
        }
        if ([401, 403, 405, 407, 429].includes(response.status)) {
          result.reachability = check('unknown', `HTTP ${response.status}: the source blocked the audit request; browser availability is unverified.`);
        } else if (response.status >= 200 && response.status < 300) {
          result.reachability = check('pass', `HTTP ${response.status}: the approved destination responded to HEAD.`);
        } else if (response.status >= 400) {
          result.reachability = check('fail', `HTTP ${response.status}: the destination is missing or unavailable.`);
        } else {
          result.reachability = check('unknown', `HTTP ${response.status}: reachability was not confirmed.`);
        }
      })
      .catch(() => { result.reachability = check('unknown', 'HTTP reachability could not be verified (offline, blocked, cancelled or timed out).'); });
  await Promise.all([handler, network]);
  return result;
}
