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

function rawTextEnd(html: string, name: string, from: number): number {
  const needle = `</${name}`;
  let index = from;
  while ((index = html.indexOf('</', index)) >= 0) {
    const afterName = index + needle.length;
    if (asciiEqualsAt(html, index, needle) && TAG_BOUNDARY.test(html[afterName] ?? '')) {
      // Once a real end-tag name starts, scan its attributes only once. An
      // incomplete end tag consumes the remainder instead of exposing it.
      const end = tagEnd(html, afterName);
      return end < 0 ? html.length : end + 1;
    }
    index += 2;
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
      const end = html.indexOf('-->', open + 4);
      index = end < 0 ? html.length : end + 3;
      continue;
    }
    const end = tagEnd(html, open + 1);
    if (end < 0) break;
    index = end + 1;
    for (const name of ['script', 'style']) {
      const afterName = open + 1 + name.length;
      if (asciiEqualsAt(html, open + 1, name) && TAG_BOUNDARY.test(html[afterName] ?? '')) {
        index = rawTextEnd(html, name, index);
        break;
      }
    }
  }
  return parts.join('');
}
