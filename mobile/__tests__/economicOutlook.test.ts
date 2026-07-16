import {
  buildEconomicOutlookFromCsv,
  economicSignal,
  parseCashForecastCsv,
  parseRbaSeriesCsv,
} from '../src/data/economicOutlook';

function seriesCsv(seriesId: string, values: [string, number][], publication = '30-Apr-2026') {
  return [
    'TABLE',
    `Title,"A title, with a comma"`,
    'Units,Per cent',
    `Publication date,${publication}`,
    `Series ID,${seriesId}`,
    ...values.map(([date, value]) => `${date},${value}`),
  ].join('\r\n');
}

const cashCsv = [
  'J1 MARKET ECONOMISTS FORECASTS',
  'Publication date,08-May-2026,08-May-2026',
  'Series ID,JCRTQF,JCRFMED',
  '01/02/2026,01/06/2026,4.10',
  '01/05/2026,01/06/2026,4.20',
  '01/05/2026,01/12/2026,3.95',
].join('\n');

describe('economic outlook', () => {
  it('parses a named sparse RBA CSV series and publication date', () => {
    const parsed = parseRbaSeriesCsv(
      seriesCsv('TEST', [['31/12/2025', 3.2], ['31/03/2026', 2.9]]),
      'TEST',
    );
    expect(parsed.publicationDate).toBe('2026-04-30');
    expect(parsed.points).toEqual([
      { date: '2025-12-31', value: 3.2 },
      { date: '2026-03-31', value: 2.9 },
    ]);
  });

  it('keeps only the latest economist survey vintage', () => {
    expect(parseCashForecastCsv(cashCsv)).toEqual({
      surveyDate: '2026-05-01',
      publicationDate: '2026-05-08',
      points: [
        { date: '2026-06-01', value: 4.2 },
        { date: '2026-12-01', value: 3.95 },
      ],
    });
  });

  it('expresses directional pressure without manufacturing a probability', () => {
    expect(economicSignal('underlying_inflation', [{ date: '2026-03-31', value: 3.4 }]).direction).toBe('higher');
    expect(economicSignal('inflation_expectations', [{ date: '2026-03-31', value: 2.5 }]).direction).toBe('balanced');
    expect(
      economicSignal('unemployment', [
        { date: '2025-10-31', value: 3.9 },
        { date: '2025-11-30', value: 4.0 },
        { date: '2025-12-31', value: 4.0 },
        { date: '2026-01-31', value: 4.0 },
        { date: '2026-02-28', value: 4.1 },
        { date: '2026-03-31', value: 4.1 },
        { date: '2026-04-30', value: 4.2 },
      ]).direction,
    ).toBe('lower');
  });

  it('builds the four-indicator model from sparse official tables', () => {
    const model = buildEconomicOutlookFromCsv({
      inflation: seriesCsv('GCPIOCPMTMYP', [['31/03/2026', 3.1]]),
      labour: seriesCsv('GLFSURSA', [
        ['31/10/2025', 4.0], ['30/11/2025', 4.0], ['31/12/2025', 4.0],
        ['31/01/2026', 4.1], ['28/02/2026', 4.1], ['31/03/2026', 4.1], ['30/04/2026', 4.1],
      ]),
      wages: seriesCsv('GWPIYP', [['31/03/2026', 3.2]]),
      expectations: seriesCsv('GMAREXPY', [['31/03/2026', 2.7]]),
      cashForecast: cashCsv,
    }, '2026-07-16T00:00:00.000Z');
    expect(model.indicators.map((indicator) => indicator.id)).toEqual([
      'underlying_inflation',
      'unemployment',
      'wages',
      'inflation_expectations',
    ]);
    expect(model.cashRateForecast?.points).toHaveLength(2);
  });
});
