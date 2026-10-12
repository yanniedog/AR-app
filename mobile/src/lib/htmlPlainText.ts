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

function tagEnd(html: string, from: number, afterName = false): number {
  let quote = '';
  let state: 'tagName' | 'attr' | 'beforeValue' | 'unquoted' = afterName ? 'attr' : 'tagName';
  const start = !afterName && html[from] === '/' ? from + 1 : from;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) quote = '';
    } else if (char === '>') {
      return index;
    } else if (state === 'tagName') {
      if (HTML_SPACE.test(char) || char === '/') state = 'attr';
    } else if (state === 'unquoted') {
      if (HTML_SPACE.test(char)) state = 'attr';
    } else if (state === 'beforeValue') {
      if (HTML_SPACE.test(char)) continue;
      if (char === '"' || char === "'") {
        quote = char;
        state = 'attr';
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
  if (name === 'script') return scriptEnd(html, from);
  const needle = `</${name}`;
  let index = from;
  while ((index = html.indexOf('</', index)) >= 0) {
    const afterName = index + needle.length;
    if (asciiEqualsAt(html, index, needle) && TAG_BOUNDARY.test(html[afterName] ?? '')) {
      // Once a real end-tag name starts, scan its attributes only once. An
      // incomplete end tag consumes the remainder instead of exposing it.
      const end = tagEnd(html, afterName, true);
      return end < 0 ? html.length : end + 1;
    }
    index += 2;
  }
  return html.length;
}

function scriptEnd(html: string, from: number): number {
  // HTML script data has escaped and double-escaped states. In the latter,
  // </script> leaves double escaping instead of closing the element.
  let state: 'data' | 'escaped' | 'double' = 'data';
  let dashes = 0;
  for (let index = from; index < html.length; index += 1) {
    if (state === 'data' && html.startsWith('<!--', index)) {
      state = 'escaped';
      dashes = 2;
      index += 3;
      continue;
    }
    if (state !== 'data' && html[index] === '-') {
      dashes = Math.min(2, dashes + 1);
      continue;
    }
    if (state !== 'data' && dashes === 2 && html[index] === '>') state = 'data';
    dashes = 0;
    if (html[index] !== '<') continue;
    if (state === 'escaped' && asciiEqualsAt(html, index, '<script')
      && TAG_BOUNDARY.test(html[index + 7] ?? '')) {
      state = 'double';
      index += 7;
    } else if (asciiEqualsAt(html, index, '</script') && TAG_BOUNDARY.test(html[index + 8] ?? '')) {
      if (state === 'double') {
        state = 'escaped';
        index += 8;
      } else {
        const end = tagEnd(html, index + 8, true);
        return end < 0 ? html.length : end + 1;
      }
    }
  }
  return html.length;
}

function commentEnd(html: string, from: number): number {
  // HTML also closes empty comments abruptly, and accepts --!> as an ending.
  if (html[from] === '>') return from + 1;
  if (html.startsWith('->', from)) return from + 2;
  for (let index = from; index < html.length; index += 1) {
    if (html.startsWith('-->', index)) return index + 3;
    if (html.startsWith('--!>', index)) return index + 4;
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
    if (!/[!?/A-Za-z]/.test(html[open + 1] ?? '')) {
      parts.push('<');
      index = open + 1;
      continue;
    }
    parts.push(' ');
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
        index = rawTextEnd(html, name, index);
        break;
      }
    }
  }
  return parts.join('');
}
