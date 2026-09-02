import {
  AppHealthNetworkPolicy,
  AppHealthNetworkPolicyError,
  executeAppHealthRequest,
  type AppHealthNetworkSessionHandle,
} from './appHealth/networkPolicy';
import type {
  AppHealthAuditMode,
  AppHealthNetworkDecision,
  AppHealthNetworkPurpose,
  AppHealthNetworkSnapshot,
  AppHealthSourceContract,
} from './appHealth/types';

interface XhrPrototype {
  open: (method: string, url: string | URL, ...rest: unknown[]) => void;
  send: (body?: unknown) => void;
}

export interface AuditTransportTarget {
  fetch: typeof fetch;
  XMLHttpRequest?: { prototype: XhrPrototype };
}

export interface AppHealthTransportGuard {
  snapshot(): AppHealthNetworkSnapshot;
  restore(): AppHealthNetworkSnapshot;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function canonical(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.searchParams.size === 1 && /^\d+$/.test(url.searchParams.get('_') ?? '')) {
      url.search = '';
    }
    url.hostname = url.hostname.toLowerCase();
    return url.toString();
  } catch {
    return null;
  }
}

function purposeFor(url: string, contract: AppHealthSourceContract): AppHealthNetworkPurpose {
  const normalized = canonical(url);
  if (normalized && normalized === canonical(contract.manifestUrl)) return 'manifest';
  if (normalized && normalized === canonical(contract.datesIndexUrl)) return 'dates-index';
  return 'asset';
}

/**
 * Install one enforceable transport boundary for the whole audit window.
 * Both fetch and XMLHttpRequest must cross the same policy before native I/O.
 */
export function installAppHealthTransportGuard(options: {
  target: AuditTransportTarget;
  mode: AppHealthAuditMode;
  contract: AppHealthSourceContract;
  declaredAssetUrls?: readonly string[];
}): AppHealthTransportGuard {
  const { target, mode, contract, declaredAssetUrls } = options;
  const policy = new AppHealthNetworkPolicy();
  const handle: AppHealthNetworkSessionHandle = policy.begin({
    mode,
    contract,
    declaredAssetUrls,
  });
  const originalFetch = target.fetch;
  const guardedFetch: typeof fetch = (input, init) => {
    const url = requestUrl(input);
    return executeAppHealthRequest(
      policy,
      handle,
      url,
      purposeFor(url, contract),
      () => originalFetch.call(target, input, init),
    );
  };
  target.fetch = guardedFetch;

  const xhrPrototype = target.XMLHttpRequest?.prototype;
  const originalOpen = xhrPrototype?.open;
  const originalSend = xhrPrototype?.send;
  const decisions = new WeakMap<object, AppHealthNetworkDecision>();
  let guardedOpen: XhrPrototype['open'] | null = null;
  let guardedSend: XhrPrototype['send'] | null = null;
  if (xhrPrototype && originalOpen && originalSend) {
    guardedOpen = function guardedXhrOpen(this: object, method, url, ...rest) {
      const rawUrl = String(url);
      decisions.set(this, policy.authorize(handle, rawUrl, purposeFor(rawUrl, contract)));
      return originalOpen.call(this, method, url, ...rest);
    };
    guardedSend = function guardedXhrSend(this: object, body) {
      const decision = decisions.get(this) ?? { allowed: false, reason: 'invalid-url' };
      if (!decision.allowed) throw new AppHealthNetworkPolicyError(decision);
      policy.recordTransport(handle, decision);
      return originalSend.call(this, body);
    };
    xhrPrototype.open = guardedOpen;
    xhrPrototype.send = guardedSend;
  }

  let restored: AppHealthNetworkSnapshot | null = null;
  const snapshot = () => policy.snapshot(handle) ?? restored ?? {
    mode,
    authorizationAttempts: 0,
    authorizedAttempts: 0,
    blockedAttempts: 0,
    transportCalls: 0,
    policyViolations: 0,
  };
  return {
    snapshot,
    restore() {
      if (target.fetch === guardedFetch) target.fetch = originalFetch;
      if (xhrPrototype && guardedOpen && xhrPrototype.open === guardedOpen) {
        xhrPrototype.open = originalOpen!;
      }
      if (xhrPrototype && guardedSend && xhrPrototype.send === guardedSend) {
        xhrPrototype.send = originalSend!;
      }
      restored = policy.end(handle) ?? snapshot();
      return restored;
    },
  };
}
