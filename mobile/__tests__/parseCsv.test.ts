import { compareIsoDate, parseCashRateTargetCsv, parseCsv, parseCsvQuoted, parseRbaSeriesCsv, parseRbaSeriesCsvFull } from '../src/data/economicOutlookParse';

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

  it('gives the same rows as the character parser on a large table', () => {
    const header = 'Series ID,FZCY1,FZCY2,FZCY3\n';
    const rows = Array.from({ length: 20000 }, (_, i) => `${(i % 28) + 1}-Jan-2024,4.${i % 10},4.2,4.1`).join('\n');
    const text = header + rows;
    expect(text.length).toBeGreaterThan(300000);
    const parsed = parseCsv(text);
    expect(parsed).toHaveLength(20001);
    expect(parsed).toEqual(parseCsvQuoted(text));
  });

  it('takes the native-split path for unquoted rows and the character parser only when quotes are present', () => {
    const split = jest.spyOn(String.prototype, 'split');
    try {
      parseCsv('a,b\n1,2\n3,4');
      // One split for the lines plus one per row; the character parser never calls split.
      expect(split.mock.calls.length).toBeGreaterThanOrEqual(4);
      split.mockClear();
      parseCsv('a,"b,c"\n1,2');
      // Only the line split and the per-line quote count; no comma split on the quoted row.
      expect(split.mock.calls.some(([separator]) => String(separator) === ',')).toBe(true);
      expect(split.mock.calls.filter(([separator]) => String(separator) === ',').length).toBe(1);
    } finally {
      split.mockRestore();
    }
  });
  describe('parseRbaSeriesCsv', () => {
    const outcome = (fn: () => unknown) => {
      try { return { value: fn() }; } catch (error) { return { error: String((error as Error).message) }; }
    };
    const same = (text: string, seriesId: string) =>
      expect(outcome(() => parseRbaSeriesCsv(text, seriesId))).toEqual(
        outcome(() => parseRbaSeriesCsvFull(text, seriesId)),
      );
    const table = [
      'Title,A,B,C',
      'Series ID,S1,S2,S3',
      'Publication date,01-Jan-2026,02-Jan-2026,03-Jan-2026',
      '31/03/2026,1.5,2.5,',
      '30-Jun-2026,1.6,,3.6',
      '30-Jun-2026,1.7,2.7,3.7',
      '30/09/2026,1.8',
      'not a date,9,9,9',
      '',
    ];

    it('gives the same series as the full parser on varied tables', () => {
      for (const id of ['S1', 'S2', 'S3', 'S9', 'Series ID']) same(table.join('\n'), id);
      same(table.join('\r\n'), 'S2');
      same(`\uFEFF${table.join('\n')}`, 'S1');
      same(table.slice(0, 2).join('\n'), 'S1');
      same(table.slice(2).join('\n'), 'S1');
      same(table.filter((line) => !line.startsWith('Publication')).join('\n'), 'S3');
      same(['"Title","A"', 'Series ID,S1', '"31/03/2026","1,500"'].join('\n'), 'S1');
      same(['Title,A', '"Series ID","S1"', 'Publication date,"01-Jan-2026"', '31/03/2026,"2.5"'].join('\n'), 'S1');
    });

    it('falls back to the full parser when a quoted field spans lines', () => {
      const text = ['Title,"multi', 'line"', 'Series ID,S1', '31/03/2026,4.5'].join('\n');
      same(text, 'S1');
      expect(parseRbaSeriesCsv(text, 'S1').points).toEqual([{ date: '2026-03-31', value: 4.5 }]);
    });

    it('matches the full parser on random tables', () => {
      const next = seeded(7);
      const pick = <T,>(items: T[]) => items[Math.floor(next() * items.length)];
      for (let run = 0; run < 300; run += 1) {
        const width = 2 + Math.floor(next() * 6);
        const ids = Array.from({ length: width }, (_, index) => `S${index}`);
        const lines = ['Title,' + ids.map(() => 'x').join(','), 'Series ID,' + ids.join(',')];
        if (next() > 0.3) lines.push('Publication date,' + ids.map(() => '01-Jan-2026').join(','));
        const rows = Math.floor(next() * 8);
        for (let row = 0; row < rows; row += 1) {
          const cells = ids.map(() => pick(['', '1.25', '-3', 'n/a', ' 4.5 ', '"7.5"', '1,5']));
          const keep = Math.max(0, cells.length - Math.floor(next() * 3));
          const date = pick(['31/03/2026', '30-Jun-2026', '1/1/2020', 'bad', '31/03/2026']);
          lines.push([date, ...cells.slice(0, keep)].join(','));
        }
        const text = lines.join(pick(['\n', '\r\n']));
        same(text, pick([...ids, 'S9']));
      }
    });

    it('does not split data rows into every cell', () => {
      const wide = ['Title,' + 'x,'.repeat(40) + 'x', 'Series ID,' + Array.from({ length: 41 }, (_, i) => `S${i}`).join(',')];
      for (let row = 0; row < 50; row += 1) wide.push(`31/03/20${10 + (row % 20)},${Array.from({ length: 41 }, (_, i) => i + row).join(',')}`);
      const split = jest.spyOn(String.prototype, 'split');
      try {
        const series = parseRbaSeriesCsv(wide.join('\n'), 'S40');
        expect(series.points.length).toBeGreaterThan(0);
        // One split for the lines, one per header line at most; never one per data row.
        expect(split.mock.calls.length).toBeLessThanOrEqual(4);
      } finally {
        split.mockRestore();
      }
    });
  });
});

describe('date ordering', () => {
  it('compareIsoDate orders ISO dates the same way as localeCompare', () => {
    const rand = seeded(7);
    const dates = Array.from({ length: 400 }, () => {
      const year = 1969 + Math.floor(rand() * 70);
      const month = 1 + Math.floor(rand() * 12);
      const day = 1 + Math.floor(rand() * 28);
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    });
    for (let i = 1; i < dates.length; i += 1) {
      expect(Math.sign(compareIsoDate(dates[i - 1], dates[i]))).toBe(Math.sign(dates[i - 1].localeCompare(dates[i])));
    }
    expect(compareIsoDate('2020-01-01', '2020-01-01')).toBe(0);
  });

  it('parses a long cash rate history without calling localeCompare (very slow on Hermes)', () => {
    const rows = ['Title,Cash rate', 'Series ID,FIRMMCRTD'];
    const start = Date.UTC(2011, 0, 1);
    for (let i = 4000; i > 0; i -= 1) {
      const d = new Date(start + i * 86_400_000);
      const day = `${d.getUTCDate()}-${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}-${d.getUTCFullYear()}`;
      rows.push(`${day},${i % 500 < 250 ? '4.35' : '4.10'}`);
    }
    const spy = jest.spyOn(String.prototype, 'localeCompare');
    try {
      const steps = parseCashRateTargetCsv(rows.join('\n'));
      expect(spy).not.toHaveBeenCalled();
      expect(steps.length).toBeGreaterThan(2);
      for (let i = 1; i < steps.length; i += 1) expect(steps[i].date > steps[i - 1].date).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
