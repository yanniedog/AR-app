/** Bounded JSON grammar check without rewriting authoritative numeric lexemes. */
export function parseBoundedEvidenceJson(text: string, maximum: number, nodesLimit = 65536): unknown {
  if (new TextEncoder().encode(text).length > maximum) throw new Error('Evidence JSON exceeds byte budget');
  let at = 0, nodes = 0;
  const primitive = /(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/y;
  const fail = (): never => { throw new Error('Invalid or excessive evidence JSON'); };
  const space = () => { while (at < text.length && /[\x20\t\r\n]/.test(text[at])) at++; };
  function string(): string {
    if (text[at++] !== '"') fail();
    const start = at - 1;
    while (at < text.length) {
      const char = text[at++];
      if (char === '"') return JSON.parse(text.slice(start, at)) as string;
      if (char === '\\') { if (at >= text.length) fail(); at++; }
      else if (char.charCodeAt(0) < 32) fail();
    }
    return fail();
  }
  function value(depth: number): void {
    if (depth > 64 || ++nodes > nodesLimit) fail();
    space(); const char = text[at];
    if (char === '"') { string(); return; }
    if (char === '{' || char === '[') {
      at++; space(); const close = char === '{' ? '}' : ']', keys = new Set<string>();
      if (text[at] === close) { at++; return; }
      while (at < text.length) {
        if (char === '{') {
          space(); const key = string();
          if (keys.has(key)) throw new Error('Duplicate evidence JSON key');
          keys.add(key); space(); if (text[at++] !== ':') fail();
        }
        value(depth + 1); space();
        if (text[at] === close) { at++; return; }
        if (text[at++] !== ',') fail();
      }
      fail();
    }
    primitive.lastIndex = at;
    const token = primitive.exec(text)?.[0];
    if (!token) return fail();
    if (/^[-\d]/.test(token) && !Number.isFinite(Number(token))) fail();
    at += token.length;
  }
  value(0); space(); if (at !== text.length) fail();
  return JSON.parse(text) as unknown;
}
