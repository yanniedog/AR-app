import {
  absPeriodToIsoDate,
  buildEconomicOutlookFromCsv,
  cashRateTargetSteps,
  economicSignal,
  loadEconomicOutlook,
  parseAbsCpiCsv,
  parseCashForecastCsv,
  parseCashRateTargetCsv,
  parseRbaSeriesCsv,
  preferNewerSeries,
} from '../src/data/economicOutlook';
import { cache } from '../src/data/cache';

function seriesCsv(seriesId: string, values: [string, number][], publication = '30-Apr-2026') {
  return multiSeriesCsv([{ id: seriesId, values }], publication);
}

/** Multi-column RBA table fixture (one publication date shared across columns). */
function multiSeriesCsv(
  columns: { id: string; values: [string, number][] }[],
  publication = '30-Apr-2026',
) {
  const dates = [...new Set(columns.flatMap((column) => column.values.map(([date]) => date)))].sort(
    (a, b) => {
      const toIso = (value: string) => {
        const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        const named = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value);
        if (!named) return value;
        const month = {
          jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
          jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
        }[named[2].toLowerCase()];
        return month ? `${named[3]}-${month}-${named[1].padStart(2, '0')}` : value;
      };
      return toIso(a).localeCompare(toIso(b));
    },
  );
  const byId = new Map(
    columns.map((column) => [column.id, new Map(column.values)] as const),
  );
  return [
    'TABLE',
    `Publication date,${columns.map(() => publication).join(',')}`,
    `Series ID,${columns.map((column) => column.id).join(',')}`,
    ...dates.map((date) =>
      `${date},${columns.map((column) => {
        const value = byId.get(column.id)?.get(date);
        return value == null ? '' : String(value);
      }).join(',')}`,
    ),
  ].join('\r\n');
}

function inflationCsv(values: [string, number][], publication?: string) {
  return multiSeriesCsv([
    { id: 'GCPIOCPMTMYP', values },
    {
      id: 'GCPIAGYP',
      values: values.map(([date, value]) => [date, Math.round((value + 0.4) * 10) / 10] as [string, number]),
    },
  ], publication);
}

function labourCsv(values: [string, number][], publication?: string) {
  return multiSeriesCsv([
    { id: 'GLFSURSA', values },
    {
      id: 'GLFSPRSA',
      values: values.map(([date, value]) => [date, Math.round((66 + value * 0.1) * 10) / 10] as [string, number]),
    },
    {
      id: 'GLFSEPTSYP',
      values: values.map(([date, value]) => [date, Math.round((2.2 + (value - 4) * 0.5) * 10) / 10] as [string, number]),
    },
  ], publication);
}

function expectationsCsv(values: [string, number][], publication?: string) {
  return multiSeriesCsv([
    { id: 'GMAREXPY', values },
    {
      id: 'GCONEXP',
      values: values.map(([date, value]) => [date, Math.round((value + 1.8) * 10) / 10] as [string, number]),
    },
  ], publication);
}

function wagesCsv(values: [string, number][], publication?: string) {
  return seriesCsv('GWPIYP', values, publication);
}

function cashRateCsv(values: [string, number][], publication = '28-Jul-2026') {
  return multiSeriesCsv([{ id: 'FIRMMCRTD', values }], publication);
}

function absHeadlineCsv(values: [string, number][]) {
  return [
    'DATAFLOW,MEASURE,INDEX,TSEST,REGION,FREQ,TIME_PERIOD,OBS_VALUE,UNIT_MEASURE',
    ...values.map(
      ([period, value]) =>
        `ABS:CPI(2.0.0),3,10001,10,50,M,${period},${value},PCT`,
    ),
  ].join('\n');
}

const cashCsv = [
  'J1 MARKET ECONOMISTS FORECASTS',
  'Publication date,08-May-2026,08-May-2026',
  'Series ID,JCRTQF,JCRFMED',
  '01/02/2026,01/06/2026,4.10',
  '01/05/2026,01/06/2026,4.20',
  '01/05/2026,01/12/2026,3.95',
].join('\n');

const defaultCashRateHistory = cashRateCsv([
  ['04-May-2022', 0.35],
  ['05-May-2022', 0.35],
  ['08-Jun-2022', 0.85],
  ['09-Jun-2022', 0.85],
  ['06-May-2026', 4.35],
  ['07-May-2026', 4.35],
]);

function csvForUrl(url: string, overrides?: {
  inflation?: string;
  labour?: string;
  wages?: string;
  expectations?: string;
  cashForecast?: string;
  cashRate?: string;
  absHeadline?: string;
}) {
  if (url.includes('data.api.abs.gov.au') || url.includes('ABS,CPI')) {
    return overrides?.absHeadline ?? absHeadlineCsv([
      ['2026-04', 4.2],
      ['2026-05', 4.0],
      ['2026-06', 3.8],
    ]);
  }
  if (url.includes('g1-data')) return overrides?.inflation ?? inflationCsv([['31/03/2026', 3.1]]);
  if (url.includes('g3-data')) return overrides?.expectations ?? expectationsCsv([['31/03/2026', 2.7]]);
  if (url.includes('h5-data')) {
    return overrides?.labour ?? labourCsv([
      ['31/10/2025', 4.0], ['30/11/2025', 4.0], ['31/12/2025', 4.0],
      ['31/01/2026', 4.1], ['28/02/2026', 4.1], ['31/03/2026', 4.1], ['30/04/2026', 4.1],
    ]);
  }
  if (url.includes('h4-data')) return overrides?.wages ?? wagesCsv([['31/03/2026', 3.2]]);
  if (url.includes('j1-cash-rate')) return overrides?.cashForecast ?? cashCsv;
  if (url.includes('f1-data')) return overrides?.cashRate ?? defaultCashRateHistory;
  throw new Error(`unexpected economic URL ${url}`);
}

function mockCsvResponse(url: string, overrides?: Parameters<typeof csvForUrl>[1]): Response {
  return {
    ok: true,
    headers: { get: () => null },
    text: async () => csvForUrl(url, overrides),
  } as unknown as Response;
}

function fullOutlookCsv(fetchedAt = '2026-07-16T00:00:00.000Z') {
  return buildEconomicOutlookFromCsv({
    inflation: inflationCsv([['31/03/2026', 3.1]]),
    labour: labourCsv([
      ['31/10/2025', 4.0], ['30/11/2025', 4.0], ['31/12/2025', 4.0],
      ['31/01/2026', 4.1], ['28/02/2026', 4.1], ['31/03/2026', 4.1], ['30/04/2026', 4.1],
    ]),
    wages: wagesCsv([['31/03/2026', 3.2]]),
    expectations: expectationsCsv([['31/03/2026', 2.7]]),
    cashForecast: cashCsv,
    cashRate: defaultCashRateHistory,
  }, fetchedAt);
}

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

  it('parses ABS monthly CPI year-ended percentages and period dates', () => {
    expect(absPeriodToIsoDate('2026-06')).toBe('2026-06-30');
    expect(absPeriodToIsoDate('2026-Q2')).toBe('2026-06-30');
    const parsed = parseAbsCpiCsv(
      absHeadlineCsv([
        ['2026-04', 4.2],
        ['2026-05', 4.0],
        ['2026-06', 3.8],
      ]),
      '2026-07-29',
    );
    expect(parsed.sourceAgency).toBe('abs');
    expect(parsed.publicationDate).toBe('2026-07-29');
    expect(parsed.points.at(-1)).toEqual({ date: '2026-06-30', value: 3.8 });
  });

  it('prefers ABS headline CPI when it is newer than RBA G1', () => {
    const model = buildEconomicOutlookFromCsv({
      inflation: inflationCsv([['31/03/2026', 3.1]]),
      labour: labourCsv([['30/04/2026', 4.1]]),
      wages: wagesCsv([['31/03/2026', 3.2]]),
      expectations: expectationsCsv([['31/03/2026', 2.7]]),
      cashForecast: cashCsv,
      cashRate: defaultCashRateHistory,
      absHeadline: absHeadlineCsv([
        ['2026-05', 4.0],
        ['2026-06', 3.8],
      ]),
      absHeadlinePublicationDate: '2026-07-29',
    });
    const headline = model.indicators.find((item) => item.id === 'headline_inflation');
    expect(headline?.sourceAgency).toBe('abs');
    expect(headline?.frequency).toBe('monthly');
    expect(headline?.points.at(-1)).toEqual({ date: '2026-06-30', value: 3.8 });
    expect(headline?.publicationDate).toBe('2026-07-29');
    expect(preferNewerSeries(
      parseAbsCpiCsv(absHeadlineCsv([['2026-06', 3.8]]), '2026-07-29'),
      parseRbaSeriesCsv(seriesCsv('GCPIAGYP', [['31/03/2026', 4.1]]), 'GCPIAGYP'),
    ).points.at(-1)?.date).toBe('2026-06-30');
  });

  it('falls back to RBA headline when ABS CPI is unavailable', async () => {
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(null);
    jest.spyOn(cache, 'writeEconomicOutlook').mockResolvedValue();
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('data.api.abs.gov.au') || url.includes('ABS,CPI')) {
        throw new Error('ABS offline');
      }
      return mockCsvResponse(url);
    });

    const outlook = await loadEconomicOutlook(true);
    const headline = outlook.indicators.find((item) => item.id === 'headline_inflation');
    expect(headline?.sourceAgency).toBe('rba');
    expect(headline?.points.at(-1)?.date).toBe('2026-03-31');
    expect(outlook.refreshErrors).toEqual(
      expect.arrayContaining([expect.stringContaining('ABS headline CPI')]),
    );
  });

  it('keeps cached ABS headline when refresh falls back to RBA on the same observation', async () => {
    const cached = buildEconomicOutlookFromCsv({
      inflation: inflationCsv([['30/06/2026', 3.4]]),
      labour: labourCsv([['30/06/2026', 4.1]]),
      wages: wagesCsv([['30/06/2026', 3.2]]),
      expectations: expectationsCsv([['30/06/2026', 2.7]]),
      cashForecast: cashCsv,
      cashRate: defaultCashRateHistory,
      absHeadline: absHeadlineCsv([
        ['2026-05', 4.0],
        ['2026-06', 3.8],
      ]),
      absHeadlinePublicationDate: '2026-07-20',
    }, '2026-07-20T00:00:00.000Z');
    const cachedHeadline = cached.indicators.find((item) => item.id === 'headline_inflation');
    expect(cachedHeadline?.sourceAgency).toBe('abs');
    expect(cachedHeadline?.points.at(-1)).toEqual({ date: '2026-06-30', value: 3.8 });

    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(cached);
    jest.spyOn(cache, 'writeEconomicOutlook').mockResolvedValue();
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('data.api.abs.gov.au') || url.includes('ABS,CPI')) {
        throw new Error('ABS offline');
      }
      return mockCsvResponse(url, {
        // Same June observation as cached ABS, with a newer RBA publication stamp.
        inflation: inflationCsv([['30/06/2026', 3.4]], '29-Jul-2026'),
        labour: labourCsv([['30/06/2026', 4.1]], '29-Jul-2026'),
        wages: wagesCsv([['30/06/2026', 3.2]], '29-Jul-2026'),
        expectations: expectationsCsv([['30/06/2026', 2.7]], '29-Jul-2026'),
      });
    });

    const outlook = await loadEconomicOutlook(true);
    const headline = outlook.indicators.find((item) => item.id === 'headline_inflation');
    expect(headline?.sourceAgency).toBe('abs');
    expect(headline?.points.at(-1)).toEqual({ date: '2026-06-30', value: 3.8 });
    expect(headline?.publicationDate).toBe('2026-07-20');
    expect(outlook.refreshErrors).toEqual(
      expect.arrayContaining([expect.stringContaining('ABS headline CPI')]),
    );
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

  it('builds the policy-indicator model from sparse official tables', () => {
    const model = fullOutlookCsv();
    expect(model.indicators.map((indicator) => indicator.id)).toEqual([
      'underlying_inflation',
      'headline_inflation',
      'unemployment',
      'participation',
      'employment_growth',
      'wages',
      'inflation_expectations',
      'consumer_inflation_expectations',
    ]);
    expect(model.cashRateForecast?.points).toHaveLength(2);
    expect(model.cashRateHistory).toEqual([
      { date: '2022-05-04', value: 0.35 },
      { date: '2022-06-08', value: 0.85 },
      { date: '2026-05-06', value: 4.35 },
    ]);
  });

  it('retains full published history so long chart windows have observations', () => {
    const quarterly = Array.from({ length: 80 }, (_, index) => {
      const year = 2006 + Math.floor(index / 4);
      const month = [3, 6, 9, 12][index % 4];
      const day = month === 3 || month === 12 ? 31 : 30;
      return [
        `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`,
        2 + (index % 7) * 0.1,
      ] as [string, number];
    });
    const monthly = Array.from({ length: 120 }, (_, index) => {
      const date = new Date(Date.UTC(2016, index, 28));
      const dd = String(date.getUTCDate()).padStart(2, '0');
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      return [`${dd}/${mm}/${date.getUTCFullYear()}`, 4 + (index % 5) * 0.1] as [string, number];
    });
    const model = buildEconomicOutlookFromCsv({
      inflation: inflationCsv(quarterly),
      labour: labourCsv(monthly),
      wages: wagesCsv(quarterly),
      expectations: expectationsCsv(quarterly),
      cashForecast: cashCsv,
      cashRate: defaultCashRateHistory,
    });
    expect(model.indicators.find((item) => item.id === 'underlying_inflation')?.points).toHaveLength(80);
    expect(model.indicators.find((item) => item.id === 'unemployment')?.points).toHaveLength(120);
  });

  it('compresses daily cash-rate target observations to decision steps', () => {
    expect(cashRateTargetSteps([
      { date: '2022-06-08', value: 0.85 },
      { date: '2022-05-05', value: 0.35 },
      { date: '2022-05-04', value: 0.35 },
      { date: '2022-06-09', value: 0.85 },
    ])).toEqual([
      { date: '2022-05-04', value: 0.35 },
      { date: '2022-06-08', value: 0.85 },
    ]);
    expect(parseCashRateTargetCsv(defaultCashRateHistory)).toEqual([
      { date: '2022-05-04', value: 0.35 },
      { date: '2022-06-08', value: 0.85 },
      { date: '2026-05-06', value: 4.35 },
    ]);
  });

  it('surfaces a forced refresh failure instead of silently returning cached data', async () => {
    const cached = fullOutlookCsv();
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(cached);
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));

    await expect(loadEconomicOutlook(true)).rejects.toThrow('offline');
  });

  it('starts a forced refresh instead of joining a background refresh already in flight', async () => {
    const cached = buildEconomicOutlookFromCsv({
      inflation: inflationCsv([['31/03/2026', 3.1]]),
      labour: labourCsv([['30/04/2026', 4.1]]),
      wages: wagesCsv([['31/03/2026', 3.2]]),
      expectations: expectationsCsv([['31/03/2026', 2.7]]),
      cashForecast: cashCsv,
      cashRate: defaultCashRateHistory,
    }, '2020-01-01T00:00:00.000Z');
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(cached);
    jest.spyOn(cache, 'writeEconomicOutlook').mockResolvedValue();
    const backgroundResolvers: (() => void)[] = [];
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (fetchMock.mock.calls.length > 7) return Promise.reject(new Error('forced offline'));
      return new Promise<Response>((resolve) => {
        backgroundResolvers.push(() => resolve(mockCsvResponse(url)));
      });
    });
    const waitForFetchCalls = async (count: number) => {
      for (let attempt = 0; attempt < 20 && fetchMock.mock.calls.length < count; attempt += 1) {
        await Promise.resolve();
      }
      expect(fetchMock).toHaveBeenCalledTimes(count);
    };

    const background = loadEconomicOutlook(false);
    await waitForFetchCalls(7);
    const forced = loadEconomicOutlook(true);
    await waitForFetchCalls(14);
    backgroundResolvers.forEach((resolve) => resolve());

    await expect(forced).rejects.toThrow('forced offline');
    await expect(background).resolves.toMatchObject({ refreshStatus: 'current' });
  });

  it('does not let an older background result overwrite a newer forced refresh', async () => {
    const cached = buildEconomicOutlookFromCsv({
      inflation: inflationCsv([['31/12/2025', 3.3]]),
      labour: labourCsv([['31/12/2025', 4.0]]),
      wages: wagesCsv([['31/12/2025', 3.4]]),
      expectations: expectationsCsv([['31/12/2025', 2.8]]),
      cashForecast: cashCsv,
      cashRate: defaultCashRateHistory,
    }, '2020-01-01T00:00:00.000Z');
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(cached);
    const writeSpy = jest.spyOn(cache, 'writeEconomicOutlook').mockResolvedValue();
    const backgroundResolvers: (() => void)[] = [];
    const responseFor = (url: string, latest: boolean) => {
      const date = latest ? '30/06/2026' : '31/03/2026';
      return mockCsvResponse(url, {
        inflation: inflationCsv([[date, latest ? 2.9 : 3.1]]),
        expectations: expectationsCsv([[date, 2.7]]),
        labour: labourCsv([[date, 4.1]]),
        wages: wagesCsv([[date, 3.2]]),
        absHeadline: absHeadlineCsv([
          [latest ? '2026-06' : '2026-03', latest ? 2.9 : 3.1],
        ]),
      });
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (fetchMock.mock.calls.length > 7) return Promise.resolve(responseFor(url, true));
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
    await waitForFetchCalls(7);
    const forced = loadEconomicOutlook(true);
    await waitForFetchCalls(14);
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
    const cached = fullOutlookCsv('2020-01-01T00:00:00.000Z');
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

  it('keeps the policy indicators when the optional cash forecast fails', async () => {
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(null);
    jest.spyOn(cache, 'writeEconomicOutlook').mockResolvedValue();
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('j1-cash-rate')) throw new Error('forecast unavailable');
      return mockCsvResponse(url);
    });

    const outlook = await loadEconomicOutlook(true);

    expect(outlook.indicators).toHaveLength(8);
    expect(outlook.cashRateForecast).toBeNull();
    expect(outlook.cashRateHistory?.at(-1)).toEqual({ date: '2026-05-06', value: 4.35 });
    expect(outlook.refreshStatus).toBe('partial');
    expect(outlook.refreshErrors).toEqual(
      expect.arrayContaining([expect.stringContaining('forecast unavailable')]),
    );
  });

  it('updates healthy official series when one required table fails', async () => {
    const aged = buildEconomicOutlookFromCsv({
      inflation: inflationCsv([['31/12/2025', 3.3]]),
      labour: labourCsv([['31/12/2025', 4.0]]),
      wages: wagesCsv([['31/12/2025', 3.4]]),
      expectations: expectationsCsv([['31/12/2025', 2.8]]),
      cashForecast: cashCsv,
      cashRate: defaultCashRateHistory,
    }, '2026-01-01T00:00:00.000Z');
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(aged);
    jest.spyOn(cache, 'writeEconomicOutlook').mockResolvedValue();
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('h4-data')) throw new Error('wages unavailable');
      return mockCsvResponse(url, {
        inflation: inflationCsv([['31/03/2026', 3.1]]),
        expectations: expectationsCsv([['31/03/2026', 2.7]]),
        labour: labourCsv([['31/03/2026', 4.1]]),
      });
    });

    const outlook = await loadEconomicOutlook(false);

    expect(outlook.refreshStatus).toBe('partial');
    expect(outlook.indicators).toHaveLength(8);
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
      inflation: inflationCsv([['30/06/2026', 3.0]]),
      labour: labourCsv([['30/06/2026', 4.1]]),
      wages: wagesCsv([['30/06/2026', 3.2]]),
      expectations: expectationsCsv([['30/06/2026', 2.7]]),
      cashForecast: cashCsv,
      cashRate: defaultCashRateHistory,
    }, '2026-07-01T00:00:00.000Z');
    jest.spyOn(cache, 'readEconomicOutlook').mockResolvedValue(cached);
    jest.spyOn(cache, 'writeEconomicOutlook').mockResolvedValue();
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      return mockCsvResponse(url, {
        inflation: inflationCsv([['31/03/2026', 3.1]]),
        expectations: expectationsCsv([['30/06/2026', 2.7]]),
        labour: labourCsv([['30/06/2026', 4.1]]),
        wages: wagesCsv([['30/06/2026', 3.2]]),
        // Older ABS than the cached June RBA observation must not regress cache.
        absHeadline: absHeadlineCsv([['2026-03', 3.1]]),
      });
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
