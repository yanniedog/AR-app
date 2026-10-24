type AuditActionParameters = Readonly<Record<string, unknown>>;

/** Each scenario enters the same listed search task as a new consumer search.
 * Rates task state survives navigation, including the first audit pass.
 * Do not reset Mortgage purpose/repayment (or wipe via EMPTY_FILTERS): the
 * criteria gate needs those facets with LVR before compare targets exist. */
export function auditSearchEntryParams(section: string | null, request: string): Record<string, string> {
  return { ...(section ? { section } : {}), request, query: '', path: '', scope: '',
    availability: 'listed', compare: '0', reset: section === 'Mortgage' ? '0' : '1' };
}

function parameters(args: readonly unknown[]): AuditActionParameters {
  const candidate = args[0];
  return candidate != null && typeof candidate === 'object' && !Array.isArray(candidate)
    ? candidate as AuditActionParameters
    : {};
}

export function auditActionString(args: readonly unknown[], key: string): string | null {
  const value = parameters(args)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function auditActionStrings(args: readonly unknown[], key: string): string[] {
  const value = parameters(args)[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

export function auditActionInteger(args: readonly unknown[], key: string): number | null {
  const value = parameters(args)[key];
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}
