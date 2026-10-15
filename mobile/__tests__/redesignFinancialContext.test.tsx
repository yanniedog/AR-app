import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import sampleDetails from '../assets/sample/details.json';
import nabCapture from './fixtures/nab_lvr_app_contract_2026-10-14.json';
import { AuditCatalogueCoverage } from '../src/components/AuditCatalogueCoverage';
import { StaySwitchChart } from '../src/components/scenario/StaySwitchChart';
import { buildStaySwitchProjection } from '../src/data/staySwitchProjection';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import { uiListedLvrRange } from '../src/lib/financialUiCopy';
import { uiDetailsProductReference } from '../src/lib/uiCopy';
import { APP_HEALTH_CHECK_CODES, type AppHealthCheck } from '../src/lib/appHealth/types';
import type { DetailsPayload, RateRow } from '../src/types';
let mockDetails: DetailsPayload | null = null;
jest.mock('../src/data/store', () => ({ useStore: (select: (state: { details: DetailsPayload | null }) => unknown) => select({ details: mockDetails }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button', Card: 'Card', Row: 'Row' }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Line: 'Line', Path: 'Path' }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { border: '#ddd', textMuted: '#666', rateLoan: '#123' } }) }));
type Tree = ReactTestRenderer & { root: { findAllByType(type: string): { props: Record<string, any> }[]; findAll(predicate: (node: { props: Record<string, any> }) => boolean): { props: Record<string, any> }[] } };
const texts = (tree: Tree) => tree.root.findAllByType('AppText').map(node => String(node.props.children)).join('\n');
test('listed LVR preserves known catalogue spellings and rejects invalid or explanatory input', () => {
  for (const value of ['LVR_70_80', 'lvr_70-80%', '70–80%']) expect(uiListedLvrRange({ lvr_tier: value })).toBe('>70%–80%');
  for (const value of ['lvr_=60%', 'LVR_LE60', '≤60%']) expect(uiListedLvrRange({ lvr_tier: value })).toBe('≤60%');
  expect(uiListedLvrRange({ lvr_tier: 'lvr_>95%' })).toBe('>95%');
  for (const value of ['LVR_80_70', 'LVR_70_101', 'LVR_70_80. Please read our conditions.', 'lvr_70%%%–80%', 'lvr_unspecified', '']) expect(uiListedLvrRange({ lvr_tier: value })).toBe('Unverified');
});

test('listed public NAB bounds remain structured inclusive facts', () => {
  const row = nabCapture.rates.find(rate => rate.lvr_tier === 'lvr_>=80.01-95%')!;
  expect(uiListedLvrRange(row)).toBe('80.01%–95%');
});

test.each([
  ['lvr_>=80.01%', '≥80.01%'],
  ['LVR_GE80p01_95', '80.01%–95%'],
  ['LVR_GT80p01_95', '>80.01%–95%'],
  ['LVR_LT95', '<95%'],
  ['lvr_<95%', '<95%'],
] as const)('listed %s preserves its endpoint flags', (lvr_tier, expected) => {
  expect(uiListedLvrRange({ lvr_tier })).toBe(expected);
});
test('a compact fixed target retains the exact comparison period and unknown reversion in visual and accessible facts', () => {
  const target: RateRow = { provider: 'Target Bank', product_key: 'target-fixed', product_name: 'Fixed loan', rate: '0.05', rate_type: 'FIXED', term: 'P2Y' };
  const scenario = normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '500000', currentRate: '6', years: '25' } });
  const projection = buildStaySwitchProjection({ target, scenario, now: new Date('2026-10-15T01:00:00Z') });
  expect(projection.ready).toBe(true); expect(projection.points).toHaveLength(25);
  const original = JSON.stringify(projection);
  let tree!: Tree; act(() => { tree = TestRenderer.create(<StaySwitchChart projection={projection} compact />) as Tree; });
  try {
    expect(texts(tree)).toContain('Projection horizon'); expect(texts(tree)).toContain('24 months · Fixed-rate scope');
    expect(texts(tree)).toContain('Reversion rate'); expect(texts(tree)).toContain('Unknown');
    expect(texts(tree)).not.toContain('Model facts'); expect(texts(tree)).not.toContain('Starting balance');
    const graph = tree.root.findAll(node => node.props.accessibilityRole === 'image')[0];
    expect(graph.props.accessibilityLabel).toContain('Projection horizon: 24 months · Fixed-rate scope · Reversion rate: Unknown');
    expect(projection.totalCostSaving).toBeNull(); expect(JSON.stringify(projection)).toBe(original);
  } finally { act(() => tree.unmount()); }
});
test('actual detail product identities preserve pipe-containing names while missing, stale and paragraph keys fail closed', () => {
  const actual = sampleDetails as unknown as DetailsPayload;
  const actualKey = Object.keys(actual.products).find(key => key.split('|').length >= 4)!;
  expect(uiDetailsProductReference(actual, actualKey)).toBe(actualKey);
  const key = 'Example Bank|id-1|Mortgage|Loan | package', paragraph = 'Please read this explanatory source paragraph.';
  const details: DetailsPayload = { schema_version: 1, run_date: '2026-10-15', products: { [key]: { displayIdentity: { provider: 'Example Bank', name: 'Loan | package', productCategory: 'Mortgage' } }, [paragraph]: {} } };
  expect(uiDetailsProductReference(details, key)).toBe(key);
  expect(uiDetailsProductReference(null, key)).toBe('Source review required');
  expect(uiDetailsProductReference({ ...details, products: {} }, key)).toBe('Source review required');
  expect(uiDetailsProductReference(details, paragraph)).toBe('Source review required');
  expect(uiDetailsProductReference({ ...details, products: { [key]: { displayIdentity: { name: 'Other loan' } } } }, key)).toBe('Source review required');
  for (const malformed of ['Read this|explanatory product id|SAVINGS|paragraph.', 'Bank|id-1|UNREVIEWED_CATEGORY|Loan', 'Bank|id 1|RESIDENTIAL_MORTGAGES|Loan']) {
    expect(uiDetailsProductReference({ ...details, products: { [malformed]: {} } }, malformed)).toBe('Source review required');
  }
});
test('expanded details-only audit rows use current catalogue identity and exclude source paragraphs', () => {
  const key = 'Bank|id-1|RESIDENTIAL_MORTGAGES|Loan', paragraph = 'Please read this explanatory source paragraph.';
  mockDetails = { schema_version: 1, run_date: '2026-10-15', products: { [key]: {}, [paragraph]: {} } };
  const check: AppHealthCheck = { id: 'coverage', code: APP_HEALTH_CHECK_CODES.CATALOGUE_COVERAGE, label: 'Catalogue coverage', domain: 'data-completeness', status: 'warn', metrics: { detailsOnlyProducts: 2 }, localEvidence: { detailsOnlyProductKeys: [key, paragraph] } };
  let tree!: Tree; act(() => { tree = TestRenderer.create(<AuditCatalogueCoverage check={check} />) as Tree; });
  try {
    act(() => tree.root.findAllByType('Button').find(node => node.props.title === 'Show')!.props.onPress());
    expect(texts(tree)).toContain(key); expect(texts(tree)).toContain('Source review required'); expect(texts(tree)).not.toContain(paragraph);
    mockDetails = null; act(() => tree.update(<AuditCatalogueCoverage check={check} />));
    expect(texts(tree)).not.toContain(key); expect(texts(tree)).toContain('Source review required');
  } finally { act(() => tree.unmount()); }
});
