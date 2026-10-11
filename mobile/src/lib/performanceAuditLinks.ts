import type { AuditCheck } from './performanceAudit';
import { auditExternalLink, type ExternalLinkAuditOptions, type ExternalLinkAuditResult } from './externalLinkAudit';
import type { TrustedExternalUrlRequest } from './trustedExternalUrl';

/** Each destination remains independently inspectable in the durable report. */
export function externalLinkAuditCheck(result: ExternalLinkAuditResult, index: number, durationMs: number): AuditCheck {
  const parts = [result.validation, result.handler, result.reachability];
  const failed = parts.some((part) => part.status === 'fail');
  const unknown = parts.some((part) => part.status === 'unknown');
  return {
    id: `external-link-${index + 1}`,
    label: `Link: ${result.label.slice(0, 120)}`,
    kind: 'network',
    status: failed ? 'fail' : unknown ? 'warn' : 'pass',
    durationMs,
    metrics: {
      executionAttempted: true,
      nonTimingFailure: failed,
      host: result.host,
      destinationPath: result.path,
      purpose: result.purpose,
      urlValidation: result.validation.status,
      browserHandler: result.handler.status,
      httpReachability: result.reachability.status,
      statusCode: result.httpStatus,
      handlerAttempted: result.handler.attempted,
      httpAttempted: result.reachability.attempted,
      validationDetail: result.validation.detail,
      handlerDetail: result.handler.detail,
      reachabilityDetail: result.reachability.detail,
    },
  };
}

export async function runExternalLinkAuditCheck(request: TrustedExternalUrlRequest, index: number, options: ExternalLinkAuditOptions): Promise<AuditCheck> {
  const started = globalThis.performance?.now?.() ?? Date.now();
  try {
    const result = await auditExternalLink(request, options);
    return externalLinkAuditCheck(result, index, (globalThis.performance?.now?.() ?? Date.now()) - started);
  } catch {
    return {
      id: `external-link-${index + 1}`,
      label: 'External link verification',
      kind: 'network',
      status: 'fail',
      durationMs: null,
      metrics: { executionAttempted: true, nonTimingFailure: true,
        reason: 'The link verifier failed before it could record a result.' },
    };
  }
}
