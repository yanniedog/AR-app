function hasLocalNetworkField(text: string): boolean {
  const decodedKeys = text.replace(/\\u([0-9a-f]{4})/gi, (_, digits: string) =>
    String.fromCharCode(parseInt(digits, 16))).replace(/\\+"/g, '"');
  return /"networkViolations"\s*:/.test(decodedKeys);
}

function withoutLocalNetworkDiagnostics(value: unknown): unknown {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text.startsWith('{') && !text.startsWith('[')) return value;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch {
      if (hasLocalNetworkField(text)) throw new Error('Local network diagnostics could not be removed from the public upload. The full log remains on this device.');
      return value;
    }
    const next = withoutLocalNetworkDiagnostics(parsed);
    return next === parsed ? value : JSON.stringify(next);
  }
  if (Array.isArray(value)) {
    const next = value.map(withoutLocalNetworkDiagnostics);
    return next.some((item, index) => item !== value[index]) ? next : value;
  }
  if (!value || typeof value !== 'object') return value;
  let changed = false;
  const entries: [string, unknown][] = [];
  for (const [key, item] of Object.entries(value)) {
    if (key === 'networkViolations') { changed = true; continue; }
    const next = withoutLocalNetworkDiagnostics(item);
    changed ||= next !== item;
    entries.push([key, next]);
  }
  return changed ? Object.fromEntries(entries) : value;
}

/** Public-upload boundary only. Full local reports and copy/share exports remain intact. */
export function publicDebugLogUploadText(text: string): string {
  return text.split('\n').map((line) => {
    const marker = 'perf-audit: ';
    let jsonStart = 0;
    let parsed: unknown;
    // A saved report may itself contain the logger marker in an error string.
    // Prefer its complete JSON before considering a physical journal prefix.
    try { parsed = JSON.parse(line); } catch {
      const eventStart = line.indexOf(marker);
      if (eventStart >= 0) jsonStart = eventStart + marker.length;
      try { parsed = JSON.parse(line.slice(jsonStart)); } catch {
        // A partial diagnostic must not escape just because a saved/logged JSON
        // record is damaged. Fail before the POST; do not discard other evidence.
        if (hasLocalNetworkField(line)) throw new Error('Local network diagnostics could not be removed from the public upload. The full log remains on this device.');
        return line;
      }
    }
    const next = withoutLocalNetworkDiagnostics(parsed);
    return next === parsed ? line : line.slice(0, jsonStart) + JSON.stringify(next);
  }).join('\n');
}
