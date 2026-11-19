import { mortgageHeadlineFacts } from '../src/components/product/ProductDetailParts';
import type { ProductDetail } from '../src/types';

const facts = (detail: ProductDetail | null) => Object.fromEntries(mortgageHeadlineFacts(detail).map(row => [row.label, row.value]));

test('headline fees keep condition status and recognise legacy ANNUAL_FEE', () => {
  const detail = { fees: [
    { label: 'ANNUAL_FEE', amount: 100 },
    { label: 'UPFRONT', name: 'Application fee', amount: 0, info: 'Waived with a package' },
  ] } as unknown as ProductDetail;
  const out = facts(detail);
  expect(out['Annual fee']).toContain('$100');
  expect(out['Upfront fee']).toContain('Conditions: Unverified');
  expect(facts(null)).toMatchObject({ 'Annual fee': 'Unknown', 'Upfront fee': 'Unknown', 'Offset account': 'Unknown' });
});

test('offset headline follows the published value and evidence state', () => {
  expect(facts({ features: [{ label: 'OFFSET' }] } as unknown as ProductDetail)['Offset account']).toBe('Yes');
  expect(facts({ features: [{ label: 'OFFSET', value: false }] } as unknown as ProductDetail)['Offset account']).toBe('No');
  const normalized = (evidenceState: string) => ({ facts: [{ id: 'f1', kind: 'feature', canonicalKey: 'features.OFFSET', sourceType: 'OFFSET',
    value: true, unit: 'boolean', evidenceState }] }) as unknown as ProductDetail;
  expect(facts(normalized('observed'))['Offset account']).toBe('Yes');
  expect(facts(normalized('unknown'))['Offset account']).toBe('Unknown');
  expect(facts(normalized('conflicting'))['Offset account']).toBe('Conflicting');
});
