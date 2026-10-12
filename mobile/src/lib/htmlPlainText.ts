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
  let state: 'tagName' | 'beforeAttr' | 'attrName' | 'afterAttr' | 'beforeValue' | 'unquoted' | 'selfClosing' = 'tagName';
  for (let index = from; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) {
        quote = '';
        state = 'beforeAttr';
      }
      continue;
    }
    if (char === '>') return index;
    if (state === 'tagName') {
      if (HTML_SPACE.test(char)) state = 'beforeAttr';
      else if (char === '/') state = 'selfClosing';
      continue;
    }
    if (state === 'selfClosing') {
      state = 'beforeAttr';
      index -= 1;
      continue;
    }
    if (state === 'beforeAttr' || state === 'afterAttr') {
      if (HTML_SPACE.test(char)) continue;
      if (char === '/') {
        state = 'selfClosing';
        continue;
      }
      if (char === '=' && state === 'afterAttr') {
        state = 'beforeValue';
        continue;
      }
      // An equals sign or quote before an attribute name is part of that name.
      // It does not open a quoted value, so the next ">" still ends the tag.
      state = 'attrName';
      continue;
    }
    if (state === 'attrName') {
      if (HTML_SPACE.test(char)) state = 'afterAttr';
      else if (char === '=') state = 'beforeValue';
      else if (char === '/') state = 'selfClosing';
      continue;
    }
    if (state === 'beforeValue') {
      if (HTML_SPACE.test(char)) continue;
      if (char === '"' || char === "'") quote = char;
      else state = 'unquoted';
      continue;
    }
    if (HTML_SPACE.test(char)) state = 'beforeAttr';
  }
  return -1;
}

function declarationEnd(html: string, from: number): number {
  let quote = '';
  let keyword = '';
  let identAllowed = false;
  for (let index = from; index < html.length; index += 1) {
    const char = html[index];
    if (quote) {
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'") {
      if (identAllowed) quote = char;
      identAllowed = false;
      continue;
    }
    if (char === '>') return index;
    if (HTML_SPACE.test(char)) {
      identAllowed = /^(?:public|system)$/i.test(keyword);
      keyword = '';
      continue;
    }
    keyword += char;
    identAllowed = false;
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
      state = 'data';
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
    if (next === '?') {
      const end = html.indexOf('>', open + 2);
      if (end < 0) break;
      parts.push(' ');
      index = end + 1;
      continue;
    }
    if (next !== '!' && next !== '/' && !/[A-Za-z]/.test(next)) {
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
    if (next === '!') {
      const doctype = asciiEqualsAt(html, open, '<!doctype')
        && TAG_BOUNDARY.test(html[open + '<!doctype'.length] ?? '');
      if (!doctype) {
        const end = html.indexOf('>', open + 2);
        if (end < 0) break;
        index = end + 1;
        continue;
      }
      const end = declarationEnd(html, open + 2);
      if (end < 0) break;
      index = end + 1;
      continue;
    }
    if (next === '/' && !/[A-Za-z]/.test(html[open + 2] || '')) {
      const end = html.indexOf('>', open + 2);
      if (end < 0) break;
      index = end + 1;
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
