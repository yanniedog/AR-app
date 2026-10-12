const HTML_SPACE = /[\t\n\f\r ]/;
const TAG_BOUNDARY = /[\t\n\f\r />]/;

function asciiEqualsAt(html: string, index: number, needle: string): boolean {
  if (index + needle.length > html.length) return false;
  for (let offset = 0; offset < needle.length; offset += 1) {
    const code = html.charCodeAt(index + offset);
    const lower = code >= 65 && code <= 90 ? code + 32 : code;
    if (lower !== needle.charCodeAt(offset)) return false;
  }
  return true;
}

function tagEnd(html: string, from: number): number {
  let quote = '';
  let state: 'name' | 'beforeValue' | 'unquoted' = 'name';
  for (let index = from; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '>') {
      return index;
    } else if (state === 'unquoted') {
      if (HTML_SPACE.test(char)) state = 'name';
    } else if (state === 'beforeValue') {
      if (HTML_SPACE.test(char)) continue;
      if (char === '"' || char === "'") {
        quote = char;
        state = 'name';
      } else {
        state = 'unquoted';
      }
    } else if (char === '=') {
      state = 'beforeValue';
    }
  }
  return -1;
}

function commentEnd(html: string, from: number): number {
  for (let index = from; index < html.length - 2; index += 1) {
    if (html.charCodeAt(index) !== 45 || html.charCodeAt(index + 1) !== 45) continue;
    if (html[index + 2] === '>') return index + 3;
    if (html[index + 2] === '!' && html[index + 3] === '>') return index + 4;
  }
  return html.length;
}

function nextNamedTag(html: string, from: number, name: string, closing: boolean): { start: number; end: number } | null {
  const needle = `${closing ? '</' : '<'}${name}`;
  let index = from;
  while ((index = html.indexOf(closing ? '</' : '<', index)) >= 0) {
    if (!closing && html.startsWith('<!--', index)) {
      index += 4;
      continue;
    }
    const afterName = index + needle.length;
    if (asciiEqualsAt(html, index, needle) && TAG_BOUNDARY.test(html[afterName] ?? '')) {
      const end = tagEnd(html, afterName);
      return { start: index, end: end < 0 ? html.length : end + 1 };
    }
    index += closing ? 2 : 1;
  }
  return null;
}

function rawTextEnd(html: string, name: string, from: number): number {
  const close = nextNamedTag(html, from, name, true);
  return close === null ? html.length : close.end;
}

function scriptRawTextEnd(html: string, from: number): number {
  let state: 'data' | 'escaped' | 'double' = 'data';
  let index = from;
  while (index < html.length) {
    if (state === 'data') {
      const comment = html.indexOf('<!--', index);
      const close = nextNamedTag(html, index, 'script', true);
      if (comment >= 0 && (close === null || comment < close.start)) {
        state = 'escaped';
        index = comment + 4;
        continue;
      }
      return close === null ? html.length : close.end;
    }
    if (state === 'double') {
      const close = nextNamedTag(html, index, 'script', true);
      if (close === null) return html.length;
      state = 'escaped';
      index = close.end;
      continue;
    }
    const dash = html.indexOf('-->', index);
    const open = nextNamedTag(html, index, 'script', false);
    const close = nextNamedTag(html, index, 'script', true);
    const candidates: { at: number; kind: 'dash' | 'open' | 'close'; next: number }[] = [];
    if (dash >= 0) candidates.push({ at: dash, kind: 'dash', next: dash + 3 });
    if (open) candidates.push({ at: open.start, kind: 'open', next: open.start + 1 + 'script'.length });
    if (close) candidates.push({ at: close.start, kind: 'close', next: close.end });
    if (candidates.length === 0) return html.length;
    candidates.sort((left, right) => left.at - right.at);
    const first = candidates[0];
    if (first.kind === 'close') return first.next;
    state = first.kind === 'dash' ? 'data' : 'double';
    index = first.next;
  }
  return html.length;
}

/** Extract plain text only. Never use this output as HTML markup. */
export function htmlPlainText(html: string): string {
  const parts: string[] = [];
  let index = 0;
  while (index < html.length) {
    const open = html.indexOf('<', index);
    if (open < 0) {
      parts.push(html.slice(index));
      break;
    }
    parts.push(html.slice(index, open), ' ');
    if (html.startsWith('<!--', open)) {
      index = commentEnd(html, open + 4);
      continue;
    }
    const end = tagEnd(html, open + 1);
    if (end < 0) break;
    index = end + 1;
    for (const name of ['script', 'style']) {
      const afterName = open + 1 + name.length;
      if (asciiEqualsAt(html, open + 1, name) && TAG_BOUNDARY.test(html[afterName] ?? '')) {
        index = name === 'script' ? scriptRawTextEnd(html, index) : rawTextEnd(html, name, index);
        break;
      }
    }
  }
  return parts.join('');
}
