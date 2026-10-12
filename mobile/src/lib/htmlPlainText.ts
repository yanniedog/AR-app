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

function namedTagAt(html: string, index: number, name: string, closing: boolean): boolean {
  const needle = `${closing ? '</' : '<'}${name}`;
  return asciiEqualsAt(html, index, needle) && TAG_BOUNDARY.test(html[index + needle.length] ?? '');
}

function scriptRawTextEnd(html: string, from: number): number {
  let state: 'data' | 'escaped' | 'double' = 'data';
  for (let index = from; index < html.length; index += 1) {
    if (state !== 'data' && html.startsWith('-->', index)) {
      state = state === 'double' ? 'escaped' : 'data';
      index += 2;
      continue;
    }
    if (html[index] !== '<') continue;
    if (state === 'data' && html.startsWith('<!--', index)) {
      state = 'escaped';
      index += 3;
      continue;
    }
    if (state === 'escaped' && namedTagAt(html, index, 'script', false)) {
      state = 'double';
      index += '<script'.length - 1;
      continue;
    }
    if ((state === 'data' || state === 'escaped') && namedTagAt(html, index, 'script', true)) {
      const end = tagEnd(html, index + '</script'.length);
      return end < 0 ? html.length : end + 1;
    }
    if (state === 'double' && namedTagAt(html, index, 'script', true)) {
      // The name returns the tokenizer to the escaped state. A later "-->"
      // in that suffix is still script data, so do not skip it as an attribute.
      state = 'escaped';
      index += '</script'.length - 1;
    }
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
    parts.push(html.slice(index, open));
    const next = html[open + 1] || '';
    if (!/[!/A-Za-z]/.test(next)) {
      parts.push('<');
      index = open + 1;
      continue;
    }
    parts.push(' ');
    if (html.startsWith('<!--', open)) {
      const after = open + 4;
      if (html[after] === '>') index = after + 1;
      else if (html.startsWith('->', after)) index = after + 2;
      else index = commentEnd(html, after);
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
