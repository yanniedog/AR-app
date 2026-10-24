/** Bound processing work without truncating a successful report's evidence.
 * Accounting is deliberately conservative and allocation-free for long text.
 * A capacity stop is a failed, incomplete audit, never a shortened full report. */
export const MAX_RETAINED_AUDIT_EVIDENCE_BYTES = 32 * 1024 * 1024;
export const MAX_AUDIT_REPORT_PROCESSING_BYTES = 64 * 1024 * 1024;

export class AuditEvidenceCapacityError extends Error {
  constructor(readonly limitBytes: number) {
    super(`Full audit evidence exceeds safe processing capacity (${limitBytes} bytes). The audit stopped without truncating retained checks.`);
    this.name = 'AuditEvidenceCapacityError';
  }
}

/** Includes object/entry overhead and UTF-16 string storage. Repeated references
 * are counted again because JSON encodes each occurrence. Cycles and excessive
 * depth fail before the serializer can recurse or allocate an enormous body. */
export function measureAuditEvidence(value: unknown, limitBytes = MAX_AUDIT_REPORT_PROCESSING_BYTES): number {
  let bytes = 0;
  const ancestors = new Set<object>();
  const add = (amount: number) => {
    bytes += amount;
    if (bytes > limitBytes) throw new AuditEvidenceCapacityError(limitBytes);
  };
  const visit = (item: unknown, depth: number): void => {
    if (depth > 64) throw new AuditEvidenceCapacityError(limitBytes);
    if (typeof item === 'string') { add(32 + item.length * 2); return; }
    if (item == null || typeof item !== 'object') { add(16); return; }
    if (ancestors.has(item)) throw new AuditEvidenceCapacityError(limitBytes);
    add(64);
    ancestors.add(item);
    try {
      if (Array.isArray(item)) {
        add(item.length * 8);
        for (const child of item) visit(child, depth + 1);
      } else {
        for (const key in item) {
          if (!Object.prototype.hasOwnProperty.call(item, key)) continue;
          add(32 + key.length * 2);
          visit((item as Record<string, unknown>)[key], depth + 1);
        }
      }
    } finally { ancestors.delete(item); }
  };
  visit(value, 0);
  return bytes;
}

/** Reserve before retaining a check. Failed reservations do not change the
 * budget or retain the rejected object; the runner records a small fatal result. */
export class AuditEvidenceBudget {
  private retainedBytes = 0;
  constructor(readonly limitBytes = MAX_RETAINED_AUDIT_EVIDENCE_BYTES) {}
  retain(check: unknown): void {
    try { this.retainedBytes += measureAuditEvidence(check, this.limitBytes - this.retainedBytes); }
    catch (error) {
      if (error instanceof AuditEvidenceCapacityError) throw new AuditEvidenceCapacityError(this.limitBytes);
      throw error;
    }
  }
}

/** Canonical semantic results are lossless; only journal copies may be cut. */
export function auditActionResultEvidence(value: unknown, limitBytes = MAX_RETAINED_AUDIT_EVIDENCE_BYTES): string | null {
  if (value == null) return null;
  measureAuditEvidence(value, limitBytes);
  return JSON.stringify(value) ?? null;
}
