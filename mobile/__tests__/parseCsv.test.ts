import { parseCsv, parseCsvQuoted } from '../src/data/economicOutlookParse';

function seeded(seed: number) {
  let s = seed;
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
}

describe('parseCsv', () => {
  it('matches the character parser on hand-written edge cases', () => {
    const cases = [
      'a,b,c\n1,2,3\n',
      '﻿Series ID,A,B\r\nX, 1 , 2\r\n\r\n,,\r\nY,3,4',
      'Title,"Rate, 1 year","say ""hi"""\n1,2,3\n',
      'a,"multi\nline",c\n1,2,3\n',
      'a,"multi\r\nline",c\r\n1,2,3',
      'a,"unterminated\n1,2,3',
      '\n\n',
      '',
      'one',
      ',,\n , ,\nx,,',
      '\r\r\n\n',
    ];
    for (const text of cases) expect(parseCsv(text)).toEqual(parseCsvQuoted(text));
  });

  it('matches the character parser on random text with commas, quotes, spaces and line breaks', () => {
    const rand = seeded(7);
    const alphabet = ['a', 'b', '1', ' ', ',', ',', '"', '\n', '\r', '\r\n', '""'];
    for (let n = 0; n < 400; n += 1) {
      let text = '';
      const length = Math.floor(rand() * 60);
      for (let i = 0; i < length; i += 1) text += alphabet[Math.floor(rand() * alphabet.length)];
      expect(parseCsv(text)).toEqual(parseCsvQuoted(text));
    }
  });

  it('parses a half-megabyte table in far less time than the character loop', () => {
    const header = 'Series ID,FZCY1,FZCY2,FZCY3\n';
    const rows = Array.from({ length: 20000 }, (_, i) => `${(i % 28) + 1}-Jan-2024,4.${i % 10},4.2,4.1`).join('\n');
    const text = header + rows;
    expect(text.length).toBeGreaterThan(300000);
    expect(parseCsv(text)).toEqual(parseCsvQuoted(text));
    const time = (fn: (t: string) => string[][]) => { const start = process.hrtime.bigint(); for (let i = 0; i < 5; i += 1) fn(text); return Number(process.hrtime.bigint() - start); };
    time(parseCsv); time(parseCsvQuoted);
    expect(time(parseCsv)).toBeLessThan(time(parseCsvQuoted));
  });
});
