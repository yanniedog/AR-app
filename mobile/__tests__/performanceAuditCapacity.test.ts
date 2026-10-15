import sample from '../assets/sample/core.json';
import type { CorePayload } from '../src/types';
import { benchmarkPayloadCapacity } from '../src/lib/performanceAuditCapacity';

test('segmented capacity preserves real sample metadata and every exact tier with stable top rates', async () => {
  let time = 0;
  const yieldControl = jest.fn(async () => undefined);
  const core = sample as CorePayload;
  const result = await benchmarkPayloadCapacity(core, { now: () => time += 1, yieldControl });
  expect(result.parsed).toEqual(core);
  expect(result.metrics.rateRows).toBe(Object.values(core.sections).reduce((sum, section) => sum + section.rates.length, 0));
  for (const [key, section] of Object.entries(core.sections)) {
    expect(result.lowestRates[key]).toEqual(section.rates.filter(row => Number.isFinite(Number(row.rate)))
      .slice().sort((left, right) => Number(left.rate) - Number(right.rate)).slice(0, 25));
  }
  expect(yieldControl.mock.calls.length).toBeGreaterThan(2);
  expect(result.metrics.chunks).toBeGreaterThan(3);
  expect(result.metrics.measurementMode).toBe('segmented-payload-capacity');
});

test('cancellation after a yield stops before the next segment', async () => {
  let cancelled = false;
  const yieldControl = jest.fn(async () => { cancelled = true; });
  await expect(benchmarkPayloadCapacity(sample as CorePayload, {
    yieldControl,
    assertActive: () => { if (cancelled) throw new Error('cancelled'); },
  })).rejects.toThrow('cancelled');
  expect(yieldControl).toHaveBeenCalledTimes(1);
});

test('brand work yields and cancellation stops before the next brand', async () => {
  let time = 0, cancelled = false, rootComplete = false;
  const yieldControl = jest.fn(async () => {
    rootComplete = true;
    if (yieldControl.mock.calls.length === 2) cancelled = true;
  });
  await expect(benchmarkPayloadCapacity(sample as CorePayload, {
    now: () => rootComplete ? time += 3 : 0,
    yieldControl,
    assertActive: () => { if (cancelled) throw new Error('brand work cancelled'); },
  })).rejects.toThrow('brand work cancelled');
  expect(Object.keys(sample.brands).length).toBeGreaterThan(1);
  expect(yieldControl).toHaveBeenCalledTimes(2);
});

test('segmented metadata retains literal prototype keys without changing object prototypes', async () => {
  const core = JSON.parse(JSON.stringify(sample)) as CorePayload;
  const provider = Object.keys(core.brands)[0];
  const original = core.brands[provider];
  Object.defineProperty(core.brands, '__proto__', { value: original, enumerable: true });
  Object.defineProperty(core, '__proto__', { value: { source: 'literal metadata key' }, enumerable: true });
  const result = await benchmarkPayloadCapacity(core, { yieldControl: async () => undefined });
  expect(result.parsed).toEqual(core);
  expect(Object.hasOwn(result.parsed, '__proto__')).toBe(true);
  expect(Object.hasOwn(result.parsed.brands, '__proto__')).toBe(true);
  expect(Object.getPrototypeOf(result.parsed.brands)).toBeNull();
});

test('embedded historical rate arrays derived from checked-in catalogue retain every observation', async () => {
  const core = JSON.parse(JSON.stringify(sample)) as CorePayload;
  const rowTiers = {} as NonNullable<CorePayload['bank_rate_history']>['row_tiers'];
  const sections = {} as NonNullable<CorePayload['bank_rate_history']>['sections'];
  for (const [key, section] of Object.entries(core.sections)) {
    const name = key as keyof typeof rowTiers;
    rowTiers[name] = section.rates.map((_, index) => index);
    sections[name] = section.rates.map(row => [[0, 1, [Number(row.rate) * 100]]]);
  }
  core.bank_rate_history = { schema_version: 1, run_dates: [core.run_date], row_tiers: rowTiers, sections };
  let time = 0;
  const yieldControl = jest.fn(async () => undefined);
  const result = await benchmarkPayloadCapacity(core, { now: () => time += 1, yieldControl });
  expect(result.parsed).toEqual(core);
  expect(result.parsed.bank_rate_history).toEqual(core.bank_rate_history);
  expect(yieldControl.mock.calls.length).toBeGreaterThan(20);
});
