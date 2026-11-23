import { debugLog } from '../lib/debugLog';

export type OfficialDataFailureStage = 'request' | 'parse';

/** Short, non-sensitive reason for a failed public-data read: status, timeout, policy or error name. */
export function officialDataFailureReason(error: unknown): string {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error ?? '');
  const status = /\((\d{3})\)/.exec(message)?.[1];
  if (status) return `http-${status}`;
  if (name === 'AbortError' || /abort/i.test(message)) return 'timeout';
  if (/not-allowlisted|policy/i.test(`${name} ${message}`)) return 'blocked-by-policy';
  if (/network request failed|failed to fetch|unable to resolve|ssl|certificate|connection/i.test(message)) return 'network';
  return `${name}: ${message.replace(/\s+/g, ' ').slice(0, 80)}`;
}

/** Records which public URL failed and why, so audits can tell an unreachable source from a parse defect. */
export function logOfficialDataFailure(url: string, stage: OfficialDataFailureStage, error: unknown): void {
  let where = 'invalid-url';
  try {
    const parsed = new URL(url);
    where = `${parsed.hostname}${parsed.pathname}`;
  } catch { /* keep placeholder */ }
  debugLog.warn('official-data', `stage=${stage} source=${where} reason=${officialDataFailureReason(error)}`);
}
