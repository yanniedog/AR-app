import { createPublicRateResolverIndex } from '../src/data/publicRateResolverIndex';
import { resolvePublicRate } from '../src/data/publicRateResolver';
import { publicDecimal, rateDecimal, decimalText } from '../src/data/publicRateDecimal';
import { PUBLIC_AS_OF, component, condition, programme } from '../testUtils/publicRates';
import { catalogue, product } from '../testUtils/publicRateJourney';

test('650000 / 72% reuses only the exact canonical predicate class and preserves every bound', () => {
  const source = programme({ conditions: [condition('purpose', { operator: 'eq', value: 'OWNER_OCCUPIED' }),
    condition('repayment', { operator: 'eq', value: 'PRINCIPAL_AND_INTEREST' }),
    condition('amount', { operator: 'bounds', minimum: '100000', maximum: '1000000' }),
    condition('lvr', { operator: 'bounds', minimum: '0.6', maximum: '0.8', minimumInclusive: false })] });
  const index = createPublicRateResolverIndex();
  for (const amount of ['650000', '650001', '100000', '99999', '1000000', '1000000.000000000000000000000001']) {
    for (const lvr of ['0.72', '0.73', '0.6', '0.600000000000000000000001', '0.8', '0.800000000000000000000001']) {
      const scenario = { amount, lvr, purpose: 'OWNER_OCCUPIED', repayment: 'PRINCIPAL_AND_INTEREST' };
      expect(index.resolve(source, scenario, PUBLIC_AS_OF)).toEqual(resolvePublicRate(source, scenario, PUBLIC_AS_OF));
    }
  }
  expect(index.stats.hits).toBeGreaterThan(0);
});

test('weighted tiers retain exact amount; alternatives and component/phase conditions remain authoritative', () => {
  const source = programme({ components: [component('base', 'payable', '0.02'), component('extra', 'payable', '0.06')],
    formula: { op: 'tiered', field: 'amount', method: 'per_tier', tiers: [
      { minimum: '0', maximum: '100', formula: { op: 'component', componentId: 'base' } },
      { minimum: '100', formula: { op: 'component', componentId: 'extra' } },
    ] } });
  const index = createPublicRateResolverIndex();
  for (const amount of ['100', '200', '300', '200']) {
    expect(index.resolve(source, { amount }, PUBLIC_AS_OF)).toEqual(resolvePublicRate(source, { amount }, PUBLIC_AS_OF));
  }
  source.formula = { op: 'alternatives', choices: [
    { conditions: [condition('package', { operator: 'eq', value: 'base' })], formula: { op: 'component', componentId: 'base' } },
    { conditions: [condition('package', { conditionId: 'extra-package', operator: 'eq', value: 'extra' })], formula: { op: 'component', componentId: 'extra' } },
  ] };
  for (const value of [undefined, 'base', 'extra', 'base']) {
    expect(index.resolve(source, { package: value }, PUBLIC_AS_OF)).toEqual(resolvePublicRate(source, { package: value }, PUBLIC_AS_OF));
  }
});

test('correction, returned-result mutation and freshness/effective boundaries cannot reuse stale quotes', () => {
  const source = programme(), index = createPublicRateResolverIndex();
  const first = index.resolve(source, {}, PUBLIC_AS_OF);
  first.reasonCodes.push('caller-only'); first.conditions.met.push(condition('purpose'));
  expect(index.resolve(source, {}, PUBLIC_AS_OF)).toEqual(resolvePublicRate(source, {}, PUBLIC_AS_OF));
  source.components[0].value = '0.03';
  expect(index.resolve(source, {}, PUBLIC_AS_OF).payableRate).toBe('0.03');
  for (const at of ['2026-10-15T23:59:59.999Z', '2026-10-16T00:00:00.001Z', PUBLIC_AS_OF])
    expect(index.resolve(source, {}, at)).toEqual(resolvePublicRate(source, {}, at));
  source.effectiveTo = '2026-10-14T01:00:00Z';
  for (const at of ['2026-10-14T00:59:59Z', '2026-10-14T01:00:00Z'])
    expect(index.resolve(source, {}, at)).toEqual(resolvePublicRate(source, {}, at));
});

test('background preparation never substitutes its representative inputs for actual input conditions', async () => {
  const source = programme({ productId: product.productId, conditions: [condition('lvr', { operator: 'bounds', maximum: '0.8' })] });
  const index = createPublicRateResolverIndex();
  jest.useFakeTimers(); jest.setSystemTime(new Date(PUBLIC_AS_OF));
  try {
    const pending = index.prepareMortgage(catalogue([source]), () => false);
    await jest.runAllTimersAsync();
    await pending;
    expect(index.stats.warmed).toBe(1);
    for (const lvr of ['0.72', '0.81', undefined])
      expect(index.resolve(source, { lvr }, PUBLIC_AS_OF)).toEqual(resolvePublicRate(source, { lvr }, PUBLIC_AS_OF));
  } finally { jest.useRealTimers(); }
});

test('numeric atoms are bounded immutable exact values; cached strings cannot admit numeric runtime inputs', () => {
  expect(publicDecimal('0.72')).toBe(publicDecimal('0.72'));
  expect(Object.isFrozen(publicDecimal('0.72'))).toBe(true);
  expect(decimalText(rateDecimal('7.2', 'percentage_points'))).toBe('0.072');
  rateDecimal('0.1', 'fraction_per_annum');
  expect(() => rateDecimal(0.1 as never, 'fraction_per_annum')).toThrow();
  expect(() => publicDecimal('NaN')).toThrow();
});

test('immutable publication ownership amortizes fingerprints but replacement and unowned mutation still revalidate', () => {
  const source = programme(), index = createPublicRateResolverIndex();
  const fingerprint = jest.spyOn(JSON, 'stringify');
  const checks = () => fingerprint.mock.calls.filter(args => args[0] === source).length;
  try {
    const resolve = index.resolveForPublication({});
    for (const lvr of ['0.72', '0.73', '0.72']) expect(resolve(source, { lvr }, PUBLIC_AS_OF)).toEqual(resolvePublicRate(source, { lvr }, PUBLIC_AS_OF));
    expect(checks()).toBe(1);
    source.components[0].value = '0.03';
    const replacement = index.resolveForPublication({});
    expect(replacement(source, {}, PUBLIC_AS_OF).payableRate).toBe('0.03'); expect(checks()).toBe(2);
    source.components[0].value = '0.04';
    expect(index.resolve(source, {}, PUBLIC_AS_OF).payableRate).toBe('0.04'); expect(checks()).toBe(3);
  } finally { fingerprint.mockRestore(); }
});
