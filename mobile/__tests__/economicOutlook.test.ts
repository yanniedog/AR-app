import {
  buildEconomicOutlookFromCsv,
  economicSignal,
  loadEconomicOutlook,
  parseCashForecastCsv,
  parseRbaSeriesCsv,
} from '../src/data/economicOutlook';
import { cache } from '../src/data/cache';

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
  afterEach(() => jest.restoreAllMocks());

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

  it('normalises single-digit RBA observation and publication dates', () => {
    const parsed = parseRbaSeriesCsv(seriesCsv('TEST', [['1/6/2026', 3.1]], '5-May-2026'), 'TEST');
    expect(parsed.publicationDate).toBe('2026-05-05');
    expect(parsed.points).toEqual([{ date: '2026-06-01', value: 3.1 }]);
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

  it('surfaces a forced refresh failure instead of silently returning cached data', async () => {
    const cached = buildEconomicOutlookFromCsv({
      inflation: seriesCsv('GCPIOCPMTMYP', [['31/03/2026', 3.1]]),
      labour: seriesCsv('GLFSURSA', [['30/04/2026', 4.1]]),
      wages: seriesCsv('GWPIYP', [['31/03/2026', 3.2]]),
      expectations: seriesCsv('GMAREXPY', [['31/03/2026', 2.7]]),
      cashForecast: cashCsv,
    }, '2026-07-16T00:00:00.000Z');
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(cached);
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));

    await expect(loadEconomicOutlook(true)).rejects.toThrow('offline');
  });

  it('starts a forced refresh instead of joining a background refresh already in flight', async () => {
    const cached = buildEconomicOutlookFromCsv({
      inflation: seriesCsv('GCPIOCPMTMYP', [['31/03/2026', 3.1]]),
      labour: seriesCsv('GLFSURSA', [['30/04/2026', 4.1]]),
      wages: seriesCsv('GWPIYP', [['31/03/2026', 3.2]]),
      expectations: seriesCsv('GMAREXPY', [['31/03/2026', 2.7]]),
      cashForecast: cashCsv,
    }, '2020-01-01T00:00:00.000Z');
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(cached);
    jest.spyOn(cache, 'writeEconomicOutlook').mockResolvedValue();
    const backgroundResolvers: (() => void)[] = [];
    const csvFor = (url: string) => url.includes('g1-data')
      ? seriesCsv('GCPIOCPMTMYP', [['31/03/2026', 3.1]])
      : url.includes('g3-data')
        ? seriesCsv('GMAREXPY', [['31/03/2026', 2.7]])
        : url.includes('h5-data')
          ? seriesCsv('GLFSURSA', [['30/04/2026', 4.1]])
          : url.includes('h4-data')
            ? seriesCsv('GWPIYP', [['31/03/2026', 3.2]])
            : cashCsv;
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (fetchMock.mock.calls.length > 5) return Promise.reject(new Error('forced offline'));
      return new Promise<Response>((resolve) => {
        backgroundResolvers.push(() => resolve({
          ok: true,
          text: async () => csvFor(url),
        } as Response));
      });
    });
    const waitForFetchCalls = async (count: number) => {
      for (let attempt = 0; attempt < 20 && fetchMock.mock.calls.length < count; attempt += 1) {
        await Promise.resolve();
      }
      expect(fetchMock).toHaveBeenCalledTimes(count);
    };

    const background = loadEconomicOutlook(false);
    await waitForFetchCalls(5);
    const forced = loadEconomicOutlook(true);
    await waitForFetchCalls(10);
    backgroundResolvers.forEach((resolve) => resolve());

    await expect(forced).rejects.toThrow('forced offline');
    await expect(background).resolves.toMatchObject({ refreshStatus: 'current' });
  });

  it('does not let an older background result overwrite a newer forced refresh', async () => {
    const cached = buildEconomicOutlookFromCsv({
      inflation: seriesCsv('GCPIOCPMTMYP', [['31/12/2025', 3.3]]),
      labour: seriesCsv('GLFSURSA', [['31/12/2025', 4.0]]),
      wages: seriesCsv('GWPIYP', [['31/12/2025', 3.4]]),
      expectations: seriesCsv('GMAREXPY', [['31/12/2025', 2.8]]),
      cashForecast: cashCsv,
    }, '2020-01-01T00:00:00.000Z');
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(cached);
    const writeSpy = jest.spyOn(cache, 'writeEconomicOutlook').mockResolvedValue();
    const backgroundResolvers: (() => void)[] = [];
    const responseFor = (url: string, latest: boolean) => {
      const date = latest ? '30/06/2026' : '31/03/2026';
      const csv = url.includes('g1-data')
        ? seriesCsv('GCPIOCPMTMYP', [[date, latest ? 2.9 : 3.1]])
        : url.includes('g3-data')
          ? seriesCsv('GMAREXPY', [[date, 2.7]])
          : url.includes('h5-data')
            ? seriesCsv('GLFSURSA', [[date, 4.1]])
            : url.includes('h4-data')
              ? seriesCsv('GWPIYP', [[date, 3.2]])
              : cashCsv;
      return { ok: true, text: async () => csv } as Response;
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (fetchMock.mock.calls.length > 5) return Promise.resolve(responseFor(url, true));
      return new Promise<Response>((resolve) => {
        backgroundResolvers.push(() => resolve(responseFor(url, false)));
      });
    });
    const waitForFetchCalls = async (count: number) => {
      for (let attempt = 0; attempt < 20 && fetchMock.mock.calls.length < count; attempt += 1) {
        await Promise.resolve();
      }
      expect(fetchMock).toHaveBeenCalledTimes(count);
    };

    const background = loadEconomicOutlook(false);
    await waitForFetchCalls(5);
    const forced = loadEconomicOutlook(true);
    await waitForFetchCalls(10);
    const forcedResult = await forced;
    backgroundResolvers.forEach((resolve) => resolve());
    const backgroundResult = await background;

    expect(forcedResult.indicators.find((item) => item.id === 'underlying_inflation')?.points.at(-1))
      .toEqual({ date: '2026-06-30', value: 2.9 });
    expect(backgroundResult).toBe(forcedResult);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy.mock.calls[0][0]).toBe(forcedResult);
  });

  it('falls back to a stale cached outlook when a background refresh fails', async () => {
    const cached = buildEconomicOutlookFromCsv({
      inflation: seriesCsv('GCPIOCPMTMYP', [['31/03/2026', 3.1]]),
      labour: seriesCsv('GLFSURSA', [['30/04/2026', 4.1]]),
      wages: seriesCsv('GWPIYP', [['31/03/2026', 3.2]]),
      expectations: seriesCsv('GMAREXPY', [['31/03/2026', 2.7]]),
      cashForecast: cashCsv,
    }, '2020-01-01T00:00:00.000Z');
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(cached);
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));

    await expect(loadEconomicOutlook(false)).resolves.toMatchObject({
      fetchedAt: cached.fetchedAt,
      indicators: cached.indicators,
      refreshStatus: 'offline',
      refreshErrors: expect.arrayContaining([
        expect.stringContaining('Underlying inflation: offline'),
      ]),
    });
  });

  it('keeps the four policy indicators when the optional cash forecast fails', async () => {
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(null);
    jest.spyOn(cache, 'writeEconomicOutlook').mockResolvedValue();
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('j1-cash-rate')) throw new Error('forecast unavailable');
      const csv = url.includes('g1-data')
        ? seriesCsv('GCPIOCPMTMYP', [['31/03/2026', 3.1]])
        : url.includes('g3-data')
          ? seriesCsv('GMAREXPY', [['31/03/2026', 2.7]])
          : url.includes('h5-data')
            ? seriesCsv('GLFSURSA', [['30/04/2026', 4.1]])
            : seriesCsv('GWPIYP', [['31/03/2026', 3.2]]);
      return { ok: true, text: async () => csv } as Response;
    });

    const outlook = await loadEconomicOutlook(true);

    expect(outlook.indicators).toHaveLength(4);
    expect(outlook.cashRateForecast).toBeNull();
    expect(outlook.refreshStatus).toBe('partial');
    expect(outlook.refreshErrors).toEqual(
      expect.arrayContaining([expect.stringContaining('forecast unavailable')]),
    );
  });

  it('updates healthy official series when one required table fails', async () => {
    const cached = buildEconomicOutlookFromCsv({
      inflation: seriesCsv('GCPIOCPMTMYP', [['31/12/2025', 3.3]]),
      labour: seriesCsv('GLFSURSA', [['31/12/2025', 4.0]]),
      wages: seriesCsv('GWPIYP', [['31/12/2025', 3.4]]),
      expectations: seriesCsv('GMAREXPY', [['31/12/2025', 2.8]]),
      cashForecast: cashCsv,
    }, '2026-01-01T00:00:00.000Z');
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(cached);
    jest.spyOn(cache, 'writeEconomicOutlook').mockResolvedValue();
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('h4-data')) throw new Error('wages unavailable');
      const csv = url.includes('g1-data')
        ? seriesCsv('GCPIOCPMTMYP', [['31/03/2026', 3.1]])
        : url.includes('g3-data')
          ? seriesCsv('GMAREXPY', [['31/03/2026', 2.7]])
          : url.includes('h5-data')
            ? seriesCsv('GLFSURSA', [['31/03/2026', 4.1]])
            : cashCsv;
      return { ok: true, text: async () => csv } as Response;
    });

    const outlook = await loadEconomicOutlook(false);

    expect(outlook.refreshStatus).toBe('partial');
    expect(outlook.indicators).toHaveLength(4);
    expect(outlook.indicators.find((item) => item.id === 'underlying_inflation')?.points.at(-1)?.date)
      .toBe('2026-03-31');
    expect(outlook.indicators.find((item) => item.id === 'wages')?.points.at(-1)?.date)
      .toBe('2025-12-31');
    expect(outlook.indicators.find((item) => item.id === 'wages')?.status).toBe('current');
    expect(outlook.refreshErrors).toEqual(
      expect.arrayContaining([expect.stringContaining('Wage growth: wages unavailable')]),
    );
  });

  it('does not replace a newer cached observation with an older official response', async () => {
    const cached = buildEconomicOutlookFromCsv({
      inflation: seriesCsv('GCPIOCPMTMYP', [['30/06/2026', 3.0]]),
      labour: seriesCsv('GLFSURSA', [['30/06/2026', 4.1]]),
      wages: seriesCsv('GWPIYP', [['30/06/2026', 3.2]]),
      expectations: seriesCsv('GMAREXPY', [['30/06/2026', 2.7]]),
      cashForecast: cashCsv,
    }, '2026-07-01T00:00:00.000Z');
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(cached);
    jest.spyOn(cache, 'writeEconomicOutlook').mockResolvedValue();
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const csv = url.includes('g1-data')
        ? seriesCsv('GCPIOCPMTMYP', [['31/03/2026', 3.1]])
        : url.includes('g3-data')
          ? seriesCsv('GMAREXPY', [['30/06/2026', 2.7]])
          : url.includes('h5-data')
            ? seriesCsv('GLFSURSA', [['30/06/2026', 4.1]])
            : url.includes('h4-data')
              ? seriesCsv('GWPIYP', [['30/06/2026', 3.2]])
              : cashCsv;
      return { ok: true, text: async () => csv } as Response;
    });

    const outlook = await loadEconomicOutlook(true);
    const inflation = outlook.indicators.find((item) => item.id === 'underlying_inflation');

    expect(outlook.refreshStatus).toBe('partial');
    expect(inflation?.points.at(-1)?.date).toBe('2026-06-30');
    expect(inflation?.status).toBe('current');
    expect(outlook.refreshErrors).toEqual(
      expect.arrayContaining([expect.stringContaining('older official response ignored')]),
    );
  });
});
