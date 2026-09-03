const REDACTED = '[REDACTED]';

export const DIAGNOSTICS_PRIVACY_NOTICE_VERSION = '2026-09-03';
export const CRASHLYTICS_PRIVACY_NOTICE_KEY = 'ar_diagnostics_privacy_notice';

/** Only events explicitly marked after the current consent can enter triage. */
export function hasCurrentDiagnosticsConsentAttestation(
  event,
  expectedNotice = DIAGNOSTICS_PRIVACY_NOTICE_VERSION,
) {
  if (!event || typeof event !== 'object') return false;
  const keys = event.customKeys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) return false;
  return String(keys[CRASHLYTICS_PRIVACY_NOTICE_KEY] ?? '') === expectedNotice;
}

/** Defense-in-depth scrub for Crashlytics fields before they leave Firebase. */
export function redactDiagnosticText(value) {
  return String(value ?? '')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, REDACTED)
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, REDACTED)
    .replace(/\b(?:bearer|token|api[_-]?key|authorization)\s*[:=]?\s*[^\s,;]+/gi, REDACTED)
    .replace(/https?:\/\/[^\s)]+/gi, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return REDACTED;
      }
    })
    .replace(/\/(?:data|storage|sdcard)\/[^\s"']+/gi, REDACTED)
    .slice(0, 12000);
}

function logMessage(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return '';
  return typeof entry.message === 'string'
    ? entry.message
    : typeof entry.log === 'string'
      ? entry.log
      : '';
}

/** Extract messages only. Event IDs, installation UUIDs, users, keys and timestamps are ignored. */
export function extractDeidentifiedEventLogs(event, maxChars = 12000) {
  if (!event || typeof event !== 'object') return null;
  const candidates = Array.isArray(event.logs)
    ? event.logs
    : Array.isArray(event.logData)
      ? event.logData
      : [];
  const lines = candidates
    .map(logMessage)
    .filter((line) => line.includes('[auto-diagnostic'))
    .map(redactDiagnosticText);
  if (!lines.length) return null;
  return lines.join('\n').slice(0, maxChars);
}
