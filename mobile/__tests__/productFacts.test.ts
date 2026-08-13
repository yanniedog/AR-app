import {
  groupProductFacts,
  factCriterionId,
  normalizedProductFacts,
  productFactDisplayModel,
  productFactSignature,
  productFactValue,
  productMatchesAllFactCriteria,
  publishedFactFilterOptions,
  boundedPublishedFactFilterOptions,
} from '../src/data/productFacts';
import type { NormalizedProductFact, ProductDetail } from '../src/types';

describe('productFacts', () => {
  test('validates downloaded facts without collapsing same-key variants', () => {
    const detail = { facts: [
      { id: 'fee-1', kind: 'fee', canonicalKey: 'MONTHLY_FEE', value: 10, unit: 'AUD', condition: 'Without package' },
      { id: 'fee-2', kind: 'fee', canonicalKey: 'MONTHLY_FEE', value: 0, unit: 'AUD', condition: 'With package' },
      { id: '', kind: 'fee', canonicalKey: 'BROKEN' },
      { id: 'unknown-1', kind: 'developer_note', canonicalKey: 'RAW' },
    ] } as unknown as ProductDetail;

    const facts = normalizedProductFacts(detail);
    expect(facts).toHaveLength(2);
    expect(facts.map((fact) => fact.id)).toEqual(['fee-1', 'fee-2']);
    expect(productFactSignature(facts[0])).not.toBe(productFactSignature(facts[1]));
  });

  test('formats normalized units, bounds and ISO cadence concisely', () => {
    expect(productFactValue({ id: 'r', kind: 'rate', canonicalKey: 'RATE', value: 0.0634, unit: 'fraction' })).toBe('6.34%');
    expect(productFactValue({ id: 'f', kind: 'fee', canonicalKey: 'FEE', value: 10, unit: 'AUD', cadence: 'P1M' })).toBe('$10 · per month');
    expect(productFactValue({ id: 'u', kind: 'fee', canonicalKey: 'FOREIGN_FEE', value: 12, unit: 'USD' })).toBe('USD 12');
    expect(productFactValue({ id: 'd', kind: 'tier', canonicalKey: 'FIXED_TERM', value: 'P1Y6M', unit: 'duration' })).toBe('1 year, 6 months');
    expect(productFactValue({ id: 'a', kind: 'eligibility', canonicalKey: 'AGE', minValue: 18, maxValue: 65, unit: 'year' })).toBe('18 years–65 years');
    expect(productFactValue({ id: 'b', kind: 'feature', canonicalKey: 'OFFSET', value: true, unit: 'boolean' })).toBe('Yes');
  });

  test('groups all distinct variants and lets rich legacy fees take precedence', () => {
    const facts: NormalizedProductFact[] = [
      { id: 'rate-1', kind: 'rate', canonicalKey: 'INTEREST_RATE', value: 0.05, unit: 'fraction' },
      { id: 'feature-1', kind: 'feature', canonicalKey: 'OFFSET', value: true },
      { id: 'condition-1', kind: 'condition', canonicalKey: 'PACKAGE', condition: 'Package required' },
      { id: 'fee-1', kind: 'fee', canonicalKey: 'ANNUAL_FEE', value: 100, unit: 'AUD' },
    ];
    const detail: ProductDetail = { facts, fees: [{ label: 'ANNUAL_FEE', amount: 100 }] };

    expect(groupProductFacts(detail).map((group) => group.key)).toEqual(['product', 'features', 'eligibility', 'fees']);
    expect(groupProductFacts(detail, { excludeFees: true }).map((group) => group.key)).toEqual(['product', 'features', 'eligibility']);
  });

  test('keeps same-key variants with distinct conditions and customer labels', () => {
    const detail: ProductDetail = { facts: [
      { id: 'tier-1', groupId: 'rate-a', kind: 'tier', canonicalKey: 'tier.balance', label: 'Balance tier', value: 'STANDARD', unit: 'enum', condition: 'Up to $50,000' },
      { id: 'tier-2', groupId: 'rate-a', kind: 'tier', canonicalKey: 'tier.balance', label: 'Balance tier', value: 'STANDARD', unit: 'enum', condition: 'Over $50,000' },
    ] };
    const grouped = groupProductFacts(detail);

    expect(grouped[0].facts).toHaveLength(2);
    expect(grouped[0].facts.map(productFactSignature)).toHaveLength(2);
    expect(new Set(grouped[0].facts.map(productFactSignature)).size).toBe(2);
  });

  test('matches typed criteria against every same-key variant without overwriting', () => {
    const detail: ProductDetail = { facts: [
      { id: 'age-1', kind: 'eligibility', canonicalKey: 'eligibility.min_age', sourceType: 'MIN_AGE', value: 21, unit: 'year', condition: 'Online applications' },
      { id: 'age-2', kind: 'eligibility', canonicalKey: 'eligibility.min_age', sourceType: 'MIN_AGE', value: 18, unit: 'year', condition: 'Branch applications' },
      { id: 'limit-1', kind: 'constraint', canonicalKey: 'constraint.max_limit', sourceType: 'MAX_LIMIT', value: 500000, unit: 'AUD' },
    ] };

    expect(productMatchesAllFactCriteria(detail, [
      { sourceType: 'MIN_AGE', operator: 'eq', value: 18, unit: 'year' },
      { sourceType: 'MAX_LIMIT', operator: 'gte', value: 400000, unit: 'AUD' },
    ])).toBe(true);
    expect(productMatchesAllFactCriteria(detail, [
      { sourceType: 'MIN_AGE', operator: 'eq', value: 19, unit: 'year' },
    ])).toBe(false);
  });

  test('builds calm curated filter options from numeric and true boolean facts', () => {
    const rows = [{ product_key: 'A|1', provider: 'Bank', product_name: 'Loan', rate: '0.05' }];
    const lookup: Record<string, ProductDetail> = { 'A|1': { facts: [
      { id: 'age', kind: 'eligibility', canonicalKey: 'eligibility.min_age', sourceType: 'MIN_AGE', label: 'Minimum age', value: 18, unit: 'year' },
      { id: 'balance', kind: 'constraint', canonicalKey: 'constraint.max_balance', sourceType: 'MAX_BALANCE', label: 'Maximum balance', value: 250000, unit: 'AUD' },
      { id: 'lvr', kind: 'constraint', canonicalKey: 'constraint.max_lvr', sourceType: 'MAX_LVR', label: 'Maximum LVR', value: 0.8, unit: 'fraction' },
      { id: 'offset', kind: 'feature', canonicalKey: 'feature.offset', sourceType: 'OFFSET', label: 'Offset account', value: true, unit: 'boolean' },
      { id: 'redraw', kind: 'feature', canonicalKey: 'feature.redraw', sourceType: 'REDRAW', label: 'Redraw', value: false, unit: 'boolean' },
      { id: 'raw', kind: 'attribute', canonicalKey: 'source.raw_path', label: 'Raw path', value: 3, unit: 'count' },
    ] } };

    expect(publishedFactFilterOptions(rows, lookup).map((option) => option.label)).toEqual([
      'Maximum balance: $250,000',
      'Maximum LVR: 80.00%',
      'Minimum age: 18 years',
      'No redraw',
      'Offset account',
    ]);
    expect(publishedFactFilterOptions(rows, lookup).map((option) => option.criterion.operator))
      .toEqual(['eq', 'eq', 'eq', 'eq', 'eq']);
    expect(publishedFactFilterOptions(rows, lookup).find((option) => option.label === 'Offset account')?.criterion)
      .toEqual({ canonicalKey: 'feature.offset', sourceType: 'OFFSET', operator: 'eq', value: true, unit: 'boolean' });
  });

  test('keeps every selected fact option visible beyond the disclosure cap', () => {
    const options = Array.from({ length: 40 }, (_, index) => {
      const criterion = {
        sourceType: `OPTION_${index}`,
        operator: 'eq' as const,
        value: index,
        unit: 'count' as const,
      };
      return { id: factCriterionId(criterion), label: `Option ${index}`, criterion };
    });
    const selected = [options[39].criterion, {
      sourceType: 'OFFSET', operator: 'eq' as const, value: true, unit: 'boolean' as const,
    }];
    const bounded = boundedPublishedFactFilterOptions(options, selected, 32);
    expect(bounded).toHaveLength(32);
    expect(bounded.slice(0, 2).map((option) => option.id)).toEqual([
      factCriterionId(options[39].criterion),
      factCriterionId(selected[1]),
    ]);
  });

  test('keeps canonical identity when generic source types are shared', () => {
    const rows = [{ product_key: 'A|1', provider: 'Bank', product_name: 'Loan', rate: '0.05' }];
    const lookup: Record<string, ProductDetail> = { 'A|1': { facts: [
      { id: 'offset', kind: 'feature', canonicalKey: 'feature.offset', sourceType: 'OTHER', label: 'Offset account', value: true, unit: 'boolean' },
      { id: 'redraw', kind: 'feature', canonicalKey: 'feature.redraw', sourceType: 'OTHER', label: 'Redraw', value: true, unit: 'boolean' },
    ] } };
    const option = publishedFactFilterOptions(rows, lookup).find((item) => item.label === 'Offset account')!;
    expect(option.criterion).toEqual({
      canonicalKey: 'feature.offset', sourceType: 'OTHER', operator: 'eq', value: true, unit: 'boolean',
    });
    expect(productMatchesAllFactCriteria({ facts: [lookup['A|1'].facts![1]] }, [option.criterion])).toBe(false);
  });

  test('applies deliberate customer-boundary direction for age and LVR', () => {
    const detail: ProductDetail = { facts: [
      { id: 'min-age', kind: 'eligibility', canonicalKey: 'eligibility.min_age', sourceType: 'MIN_AGE', minValue: 18, unit: 'year' },
      { id: 'max-age', kind: 'eligibility', canonicalKey: 'eligibility.max_age', sourceType: 'MAX_AGE', maxValue: 70, unit: 'year' },
      { id: 'max-lvr', kind: 'constraint', canonicalKey: 'constraint.max_lvr', sourceType: 'MAX_LVR', maxValue: 0.8, unit: 'fraction' },
    ] };

    expect(productMatchesAllFactCriteria(detail, [
      { sourceType: 'MIN_AGE', operator: 'lte', value: 20, unit: 'year' },
      { sourceType: 'MAX_AGE', operator: 'gte', value: 65, unit: 'year' },
      { sourceType: 'MAX_LVR', operator: 'gte', value: 0.75, unit: 'fraction' },
    ])).toBe(true);
    expect(productMatchesAllFactCriteria(detail, [
      { sourceType: 'MIN_AGE', operator: 'lte', value: 17, unit: 'year' },
    ])).toBe(false);
    expect(productMatchesAllFactCriteria(detail, [
      { sourceType: 'MAX_AGE', operator: 'gte', value: 71, unit: 'year' },
    ])).toBe(false);
    expect(productMatchesAllFactCriteria(detail, [
      { sourceType: 'MAX_LVR', operator: 'gte', value: 0.85, unit: 'fraction' },
    ])).toBe(false);
  });

  test('keeps explicit false out of has-feature matching but offers it as a typed filter', () => {
    const rows = [{ product_key: 'A|1', provider: 'Bank', product_name: 'Loan', rate: '0.05' }];
    const detail: ProductDetail = { facts: [
      { id: 'offset-yes', kind: 'feature', canonicalKey: 'feature.offset', sourceType: 'OFFSET', label: 'Offset account', value: true, unit: 'boolean' },
      { id: 'redraw-no', kind: 'feature', canonicalKey: 'feature.redraw', sourceType: 'REDRAW', label: 'Redraw', value: false, unit: 'boolean' },
    ] };
    const options = publishedFactFilterOptions(rows, { 'A|1': detail });

    expect(options.map((option) => option.label)).toEqual(['No redraw', 'Offset account']);
    expect(productMatchesAllFactCriteria(detail, [
      { sourceType: 'REDRAW', operator: 'eq', value: false, unit: 'boolean' },
    ])).toBe(true);
  });

  test('keeps two associated rate tiers as collapsed clusters without repeated rate rows', () => {
    const detail: ProductDetail = { facts: [
      { id: 'rate-a', groupId: 'tier-a', kind: 'rate', canonicalKey: 'rate.advertised', label: 'Advertised rate', value: 0.05, unit: 'fraction' },
      { id: 'tier-a', groupId: 'tier-a', kind: 'tier', canonicalKey: 'tier.balance', label: 'Up to $50,000', maxValue: 50000, unit: 'AUD' },
      { id: 'condition-a', groupId: 'tier-a', parentId: 'rate-a', kind: 'condition', canonicalKey: 'condition.balance', label: 'Tier condition', condition: 'Balance up to $50,000' },
      { id: 'rate-b', groupId: 'tier-b', kind: 'rate', canonicalKey: 'rate.advertised', label: 'Advertised rate', value: 0.055, unit: 'fraction' },
      { id: 'tier-b', groupId: 'tier-b', kind: 'tier', canonicalKey: 'tier.balance', label: 'Over $50,000', minValue: 50000, unit: 'AUD' },
      { id: 'condition-b', groupId: 'tier-b', parentId: 'rate-b', kind: 'condition', canonicalKey: 'condition.balance', label: 'Tier condition', condition: 'Balance over $50,000' },
    ] };

    const model = productFactDisplayModel(detail);
    expect(normalizedProductFacts(detail)).toHaveLength(6);
    expect(model.rateClusters).toHaveLength(2);
    expect(model.rateClusters.flatMap((cluster) => cluster.facts).filter((fact) => fact.kind === 'rate')).toHaveLength(0);
    expect(model.rateClusters.map((cluster) => cluster.facts.find((fact) => fact.kind === 'condition')?.condition)).toEqual([
      'Balance up to $50,000',
      'Balance over $50,000',
    ]);
  });

  test('keeps a valid standalone tier visible when it has no association ids', () => {
    const detail: ProductDetail = { facts: [{
      id: 'standalone-tier', kind: 'tier', canonicalKey: 'tier.balance',
      label: 'Balance tier', minValue: 1000, maxValue: 5000, unit: 'AUD',
    }] };
    const model = productFactDisplayModel(detail);
    expect(model.rateClusters).toEqual([]);
    expect(model.groups.flatMap((group) => group.facts).map((fact) => fact.id))
      .toContain('standalone-tier');
  });
});
