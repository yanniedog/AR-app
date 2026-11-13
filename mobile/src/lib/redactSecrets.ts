const SECRET_VALUE = String.raw`[^\s,;}"']+`;
const SECRET_SOURCES: string[] = [
  String.raw`EXPO_TOKEN[=:\s]${SECRET_VALUE}`,
  String.raw`Bearer\s+${SECRET_VALUE}`,
  String.raw`Authorization:\s*(?:(?:Bearer|Basic)\s+)?${SECRET_VALUE}`,
  String.raw`(?:api[_-]?key|secret|password|token)[=:\s]${SECRET_VALUE}`,
  String.raw`"(?:EXPO_TOKEN|Authorization|api[_-]?key|secret|password|token)"\s*:\s*"[^"]+"`,
  String.raw`'(?:EXPO_TOKEN|Authorization|api[_-]?key|secret|password|token)'\s*:\s*'[^']+'`,
];
/**
 * One alternation rather than six sequential passes. Redaction runs over the
 * whole megabyte-scale audit report and the whole 2MB log on the JS thread, so
 * each avoided pass is a full scan and a full string copy the UI thread no
 * longer waits on.
 */
const SECRET_PATTERN = new RegExp(SECRET_SOURCES.map((source) => `(?:${source})`).join('|'), 'gi');
const PRIVATE_IDENTIFIER_PATTERN =
  /\b(uid|user[_-]?id|subscription[_-]?id|subscriptionId)\s*[=:]\s*[^\s,;}"']+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

/** Strip likely secrets before lines are stored or uploaded. */
export function redactSecrets(text: string): string {
  // Most audit records contain none of these fields. Avoid expensive value
  // matching (especially the email pattern) across megabytes of ordinary JSON.
  let result = text;
  if (/EXPO_TOKEN|Bearer|Authorization|api[_-]?key|secret|password|token/i.test(result)) {
    result = result.replace(SECRET_PATTERN, (match) => {
      // Preserve the quoted header/field shape in the complete audit JSON.
      const quotedPrefix = match.match(/^((["'])[^"']+\2\s*:\s*)(["'])/);
      if (quotedPrefix) return `${quotedPrefix[1]}${quotedPrefix[3]}[REDACTED]${quotedPrefix[3]}`;
      const key = match.split(/[=:\s]/)[0] ?? 'secret';
      return `${key}=[REDACTED]`;
    });
  }
  if (/uid|user[_-]?id|subscription[_-]?id|subscriptionId/i.test(result)) {
    result = result.replace(PRIVATE_IDENTIFIER_PATTERN, (_match, key: string) => `${key}=[REDACTED]`);
  }
  return result.includes('@') ? result.replace(EMAIL_PATTERN, '[REDACTED_EMAIL]') : result;
}
