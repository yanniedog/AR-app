import { readFileSync } from 'fs';
import { join } from 'path';

import { cache } from '../src/data/cache';
import {
  loadRbaMarketOutlook,
  parseRbaBondForwardsCsv,
  parseRbaEconomistsCsv,
  RBA_F17_FORWARD_URL,
  RBA_J1_FORECAST_URL,
  resetRbaMarketOutlookRuntimeCacheForTests,
  type RbaMarketOutlook,
} from '../src/data/rbaMarketOutlook';
import { normalizeRbaMarketOutlook, rbaSourceToday } from '../src/data/rbaMarketOutlookParse';
import { isLocalAppHealthAudit } from '../src/lib/appHealthTransportGuard';

jest.mock('../src/lib/appHealthTransportGuard', () => ({ isLocalAppHealthAudit: jest.fn(() => false) }));

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', 'rba-market', name), 'utf8');
const bondsCsv = fixture('f17-2026-09-04.csv');
const economistsCsv = fixture('j1-2026-08-28.csv');
const NOW = Date.parse('2026-09-22T12:00:00.000Z');
const originalFetch = globalThis.fetch;
const localAudit = jest.mocked(isLocalAppHealthAudit);

function payload(checkedAt = '2026-09-21T00:00:00.000Z'): RbaMarketOutlook {
  return {
    schema_version: 1,
    fetchedAt: checkedAt,
    checkedAt,
    refreshStatus: 'current',
    bondForwards: parseRbaBondForwardsCsv(bondsCsv),
    economists: parseRbaEconomistsCsv(economistsCsv),
  };
}

function response(text: string): Response {
  return { ok: true, text: async () => text } as Response;
}

function fetchOfficial() {
  return jest.fn(async (url: RequestInfo | URL) => response(
    String(url) === RBA_F17_FORWARD_URL ? bondsCsv : economistsCsv,
  ));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((accept) => { resolve = accept; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
  resetRbaMarketOutlookRuntimeCacheForTests();
  localAudit.mockReturnValue(false);
  jest.spyOn(cache, 'readRbaMarketOutlook').mockResolvedValue(null);
  jest.spyOn(cache, 'writeRbaMarketOutlook').mockResolvedValue();
  globalThis.fetch = fetchOfficial();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  globalThis.fetch = originalFetch;
});

test('parses the actual F17 vintage and anchors quarter-year horizons to its trading date', () => {
  const curve = parseRbaBondForwardsCsv(bondsCsv);
  expect(curve).toEqual({
    observationDate: '2026-08-31',
    publicationDate: '2026-09-04',
    points: [
      { date: '2026-08-31', value: 4.35, horizonMonths: 0 },
      { date: '2026-11-30', value: 4.57, horizonMonths: 3 },
      { date: '2027-02-28', value: 4.67, horizonMonths: 6 },
      { date: '2027-05-31', value: 4.68, horizonMonths: 9 },
      { date: '2027-08-31', value: 4.65, horizonMonths: 12 },
    ],
  });
});

test('uses a single complete curve instead of mixing missing tenors across trading dates', () => {
  const curve = parseRbaBondForwardsCsv(bondsCsv.replace('31-Aug-2026,4.35,4.57,4.67', '31-Aug-2026,4.35,,4.67'));
  expect(curve.observationDate).toBe('2026-08-28');
  expect(curve.points.map((point) => point.value)).toEqual([4.35, 4.56, 4.68, 4.69, 4.65]);
});

test('ignores impossible dates, future observations and non-finite forward values', () => {
  const invalid = `${bondsCsv}\n31-Feb-2026,1,2,3,4,5\n23-Sep-2026,1,2,3,4,5\n01-Sep-2026,1,Infinity,3,4,5`;
  expect(parseRbaBondForwardsCsv(invalid).observationDate).toBe('2026-08-31');
});

test.each([
  bondsCsv.replaceAll('04-Sep-2026', '31-Feb-2026'),
  bondsCsv.replaceAll('04-Sep-2026', '23-Sep-2026'),
  bondsCsv.replace('FZCF75D', 'OTHER'),
  bondsCsv.replace('Source,RBA', 'Source,Vendor'),
])('rejects an unrecognised or invalid F17 publication', (csv) => {
  expect(() => parseRbaBondForwardsCsv(csv)).toThrow();
});

test('keeps the actual economists median survey separate from market forwards', () => {
  const survey = parseRbaEconomistsCsv(economistsCsv);
  expect(survey.surveyDate).toBe('2026-08-01');
  expect(survey.publicationDate).toBe('2026-08-28');
  expect(survey.points).toEqual([
    { date: '2026-12-01', value: 4.35 },
    { date: '2027-06-01', value: 4.35 },
    { date: '2027-12-01', value: 4.1 },
    { date: '2028-06-01', value: 3.85 },
    { date: '2028-12-01', value: 3.85 },
  ]);
});

test('ignores future survey rows while retaining valid future forecast targets', () => {
  const forecast = parseRbaEconomistsCsv(`${economistsCsv}\n01/10/2026,01/12/2026,6.5,6.5,6,7,30,0.1`);
  expect(forecast.surveyDate).toBe('2026-08-01');
  expect(forecast.points.at(-1)?.date).toBe('2028-12-01');
});

test('rejects invalid survey dates and non-RBA forecast sources', () => {
  expect(() => parseRbaEconomistsCsv(economistsCsv.replace('Source,RBA,RBA', 'Source,RBA,Vendor'))).toThrow();
  expect(() => parseRbaEconomistsCsv(economistsCsv.replaceAll('28-Aug-2026', '31-Feb-2026'))).toThrow();
});

test('Australian source date accepts the next Australian day before midnight UTC', () => {
  expect(rbaSourceToday(Date.parse('2026-09-21T15:00:00Z'))).toBe('2026-09-22');
});

test('a damaged cached optional series does not discard the valid other source', () => {
  const cached = payload();
  cached.bondForwards!.points[1].value = Infinity;
  const normalized = normalizeRbaMarketOutlook(cached);
  expect(normalized?.bondForwards).toBeNull();
  expect(normalized?.economists).toEqual(cached.economists);
  expect(normalized?.refreshStatus).toBe('partial');
});

test('rejects cached curves with mismatched horizon dates or future observations', () => {
  const cached = payload();
  cached.economists = null;
  cached.bondForwards!.points[1].date = '2026-12-22';
  expect(normalizeRbaMarketOutlook(cached)).toBeNull();
  expect(normalizeRbaMarketOutlook({ ...payload(), checkedAt: '2099-01-01T00:00:00Z' })).toBeNull();
});

test('loads both official sources, preserves source dates and persists a bounded public cache', async () => {
  const result = await loadRbaMarketOutlook();
  expect(result.refreshStatus).toBe('current');
  expect(result.bondForwards?.observationDate).toBe('2026-08-31');
  expect(result.economists?.surveyDate).toBe('2026-08-01');
  expect(result.fetchedAt).toBe(new Date(NOW).toISOString());
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenCalledWith(RBA_J1_FORECAST_URL, expect.any(Object));
  expect(cache.writeRbaMarketOutlook).toHaveBeenCalledWith(result);
  expect(Object.isFrozen(result.bondForwards?.points)).toBe(true);
});

test('coalesces simultaneous requests and respects cached recheck interval', async () => {
  const [first, second] = await Promise.all([loadRbaMarketOutlook(), loadRbaMarketOutlook()]);
  expect(second).toEqual(first);
  await loadRbaMarketOutlook();
  expect(fetch).toHaveBeenCalledTimes(2);
  await loadRbaMarketOutlook(true);
  expect(fetch).toHaveBeenCalledTimes(4);
});

test('keeps cached bonds when only the economist source refreshes', async () => {
  const cached = payload();
  jest.mocked(cache.readRbaMarketOutlook).mockResolvedValue(cached);
  globalThis.fetch = jest.fn(async (url) => {
    if (String(url) === RBA_F17_FORWARD_URL) throw new Error('offline');
    return response(economistsCsv);
  });
  const result = await loadRbaMarketOutlook(true);
  expect(result.refreshStatus).toBe('partial');
  expect(result.bondForwards).toEqual(cached.bondForwards);
  expect(result.economists).toEqual(cached.economists);
});

test('allows a usable partial first fetch and does not invent the missing series', async () => {
  globalThis.fetch = jest.fn(async (url) => response(String(url) === RBA_F17_FORWARD_URL ? bondsCsv : '<html>Error</html>'));
  const result = await loadRbaMarketOutlook();
  expect(result.bondForwards).not.toBeNull();
  expect(result.economists).toBeNull();
  expect(result.refreshStatus).toBe('partial');
});

test('an older official response cannot replace a newer cached curve', async () => {
  const cached = payload();
  cached.bondForwards = parseRbaBondForwardsCsv(
    bondsCsv.replaceAll('04-Sep-2026', '21-Sep-2026').replace('31-Aug-2026', '20-Sep-2026'),
  );
  jest.mocked(cache.readRbaMarketOutlook).mockResolvedValue(cached);
  const result = await loadRbaMarketOutlook(true);
  expect(result.bondForwards?.observationDate).toBe('2026-09-20');
  expect(result.refreshStatus).toBe('partial');
});

test('offline refresh keeps original observation and fetch dates, including a forced refresh', async () => {
  const cached = payload();
  jest.mocked(cache.readRbaMarketOutlook).mockResolvedValue(cached);
  globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  const result = await loadRbaMarketOutlook(true);
  expect(result.refreshStatus).toBe('offline');
  expect(result.fetchedAt).toBe(cached.fetchedAt);
  expect(result.bondForwards).toEqual(cached.bondForwards);
  expect(result.checkedAt).toBe(new Date(NOW).toISOString());
});

test('a completely unavailable first fetch fails explicitly', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  await expect(loadRbaMarketOutlook()).rejects.toThrow('could not be loaded');
  expect(cache.writeRbaMarketOutlook).not.toHaveBeenCalled();
});

test('local audit uses validated cache without a request, even when forced', async () => {
  const cached = payload();
  jest.mocked(cache.readRbaMarketOutlook).mockResolvedValue(cached);
  localAudit.mockReturnValue(true);
  const result = await loadRbaMarketOutlook(true);
  expect(result).toEqual({ ...cached, refreshStatus: 'offline' });
  expect(fetch).not.toHaveBeenCalled();
  expect(cache.writeRbaMarketOutlook).not.toHaveBeenCalled();
});

test('local audit rejects a missing or invalid cache without contacting a source', async () => {
  localAudit.mockReturnValue(true);
  jest.mocked(cache.readRbaMarketOutlook).mockResolvedValue({ ...payload(), schema_version: 99 } as unknown as RbaMarketOutlook);
  await expect(loadRbaMarketOutlook()).rejects.toThrow('not cached');
  expect(fetch).not.toHaveBeenCalled();
});

test('a local guard installed while reading the cache prevents the initial network request', async () => {
  const read = deferred<RbaMarketOutlook | null>();
  jest.mocked(cache.readRbaMarketOutlook).mockReturnValue(read.promise);
  const loading = loadRbaMarketOutlook();
  localAudit.mockReturnValue(true);
  read.resolve(payload());
  await expect(loading).resolves.toHaveProperty('refreshStatus', 'offline');
  expect(fetch).not.toHaveBeenCalled();
});

test('a slower earlier fetch cannot overwrite a successful forced refresh', async () => {
  const pending = [deferred<Response>(), deferred<Response>()];
  const fetchMock = fetchOfficial()
    .mockImplementationOnce(() => pending[0].promise)
    .mockImplementationOnce(() => pending[1].promise);
  globalThis.fetch = fetchMock;
  const slow = loadRbaMarketOutlook();
  await jest.advanceTimersByTimeAsync(0);
  const fresh = await loadRbaMarketOutlook(true);
  pending[0].resolve(response(bondsCsv.replace('31-Aug-2026,4.35,4.57', '31-Aug-2026,4.35,1.11')));
  pending[1].resolve(response(economistsCsv));
  expect(await slow).toBe(fresh);
  expect(cache.writeRbaMarketOutlook).toHaveBeenCalledTimes(1);
});

test('a valid earlier result can fill a missing source without regressing the newer source', async () => {
  const pending = [deferred<Response>(), deferred<Response>()];
  globalThis.fetch = jest.fn()
    .mockImplementationOnce(() => pending[0].promise)
    .mockImplementationOnce(() => pending[1].promise)
    .mockResolvedValueOnce(response('Unavailable'))
    .mockResolvedValueOnce(response(economistsCsv.replace('01/08/2026,01/12/2026,4.35', '01/08/2026,01/12/2026,4.5')));
  const slow = loadRbaMarketOutlook();
  await jest.advanceTimersByTimeAsync(0);
  const fresh = await loadRbaMarketOutlook(true);
  expect(fresh.bondForwards).toBeNull();
  pending[0].resolve(response(bondsCsv));
  pending[1].resolve(response(economistsCsv));
  const merged = await slow;
  expect(merged.bondForwards).not.toBeNull();
  expect(merged.economists?.points[0].value).toBe(4.5);
});

test('a disk write failure retains validated data for subsequent local audits', async () => {
  jest.mocked(cache.writeRbaMarketOutlook).mockRejectedValue(new Error('disk full'));
  const fresh = await loadRbaMarketOutlook();
  localAudit.mockReturnValue(true);
  expect((await loadRbaMarketOutlook()).bondForwards).toEqual(fresh.bondForwards);
  expect(fetch).toHaveBeenCalledTimes(2);
});
