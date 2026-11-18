import type { AuditCheck } from './performanceAudit';
import { auditExternalLink, type ExternalLinkAuditCheck, type ExternalLinkAuditOptions, type ExternalLinkAuditResult } from './externalLinkAudit';
import type { TrustedExternalUrlRequest } from './trustedExternalUrl';
import { getPreloadedExternalLink } from './passiveAudit';

/** Attempted evidence is selected. An explicit not-selected facet stays out of the sample. */
function recordedHttpSelected(reachability: ExternalLinkAuditCheck): boolean | undefined {
  if (reachability.selection === 'selected') return true;
  if (reachability.selection === 'not-selected') return false;
  return reachability.attempted ? true : undefined;
}

/** pass/fail are resolved. not-attempted was outside the handler sample.
 * unresolved means the platform was asked and could not produce pass or fail. */
function recordedHandlerResolution(handler: ExternalLinkAuditCheck): 'pass' | 'fail' | 'not-attempted' | 'unresolved' | undefined {
  if (handler.status === 'pass') return 'pass';
  if (handler.status === 'fail') return 'fail';
  if (handler.selection === 'not-selected') return 'not-attempted';
  if (!handler.attempted && handler.selection !== 'selected') return undefined;
  if (!handler.attempted) return 'unresolved';
  return handler.status === 'unknown' ? 'unresolved' : undefined;
}

export function externalLinkAuditCheckId(index: number): string {
  return `external-link-${index + 1}`;
}

/** Each destination remains independently inspectable in the durable report. */
export function externalLinkAuditCheck(result: ExternalLinkAuditResult, index: number, durationMs: number): AuditCheck {
  const parts = [result.validation, result.handler, result.reachability];
  const failure = parts.find((part) => part.status === 'fail');
  const unknown = parts.some((part) => part.status === 'unknown');
  const httpSelected = recordedHttpSelected(result.reachability);
  const handlerResolution = recordedHandlerResolution(result.handler);
  return {
    id: externalLinkAuditCheckId(index),
    label: `Link: ${result.label.slice(0, 120)}`,
    kind: 'network',
    status: failure ? 'fail' : unknown ? 'warn' : 'pass',
    durationMs,
    ...(failure ? { error: failure.detail || 'External destination verification failed.' } : {}),
    metrics: {
      executionAttempted: true,
      nonTimingFailure: failure != null,
      host: result.host,
      destinationPath: result.path,
      purpose: result.purpose,
      urlValidation: result.validation.status,
      browserHandler: result.handler.status,
      httpReachability: result.reachability.status,
      statusCode: result.httpStatus,
      ...(result.httpIssue ? { httpIssue: result.httpIssue } : {}),
      handlerAttempted: result.handler.attempted,
      httpAttempted: result.reachability.attempted,
      ...(httpSelected !== undefined ? { httpSelected } : {}),
      ...(handlerResolution !== undefined ? { handlerResolution } : {}),
      validationDetail: result.validation.detail,
      handlerDetail: result.handler.detail,
      reachabilityDetail: result.reachability.detail,
    },
  };
}

export async function runExternalLinkAuditCheck(request: TrustedExternalUrlRequest, index: number, options: ExternalLinkAuditOptions): Promise<AuditCheck> {
  const started = globalThis.performance?.now?.() ?? Date.now();
  const prepared = !options.reachability && !options.signal?.aborted ? getPreloadedExternalLink(request) : null;
  if (prepared && (options.handler === false || prepared.result.validation.status === 'fail' ||
    prepared.result.handler.status !== 'unknown')) {
    const result = externalLinkAuditCheck(prepared.result, index, (globalThis.performance?.now?.() ?? Date.now()) - started);
    result.metrics = { ...result.metrics, preloaded: true, backgroundDurationMs: prepared.durationMs, preloadedAgeMs: Math.max(0, Date.now() - prepared.checkedAt) };
    return result;
  }
  try {
    const result = await auditExternalLink(request, options);
    return externalLinkAuditCheck(result, index, (globalThis.performance?.now?.() ?? Date.now()) - started);
  } catch {
    return {
      id: externalLinkAuditCheckId(index),
      label: 'External link verification',
      kind: 'network',
      status: 'fail',
      durationMs: null,
      metrics: { executionAttempted: true, nonTimingFailure: true,
        reason: 'The link verifier failed before it could record a result.' },
    };
  }
}
