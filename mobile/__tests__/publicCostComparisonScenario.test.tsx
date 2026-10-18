import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { PublicCostComparison } from '../src/components/scenario/PublicCostComparison';
import { catalogue, product, programme, row } from '../testUtils/publicRateJourney';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';

let mockCatalogue: ReturnType<typeof catalogue>;
jest.mock('../src/data/publicRateCatalogue', () => ({ usePublicRateCatalogue: () => mockCatalogue }));
jest.mock('../src/data/store', () => ({ useStore: (select: (state: unknown) => unknown) => select({ manifest: null, prefs: jest.requireActual('../src/data/storeTypes').DEFAULT_PREFS, details: { products: {} } }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Disclosure: 'Disclosure' }));
type Tree = ReactTestRenderer & { root: { findAllByType(type: string): { props: Record<string, any> }[] } };

test('the rendered cost disclosure uses the same amount and LVR as the selected pricing scope', () => {
  const p = programme({ conditions: [
    { conditionId: 'amount', field: 'amount', operator: 'bounds', minimum: '500000', evidenceIds: [] },
    { conditionId: 'lvr', field: 'lvr', operator: 'bounds', maximum: '0.8', evidenceIds: [] },
  ], components: [{ ...programme().components[0], value: '0.05' }] });
  mockCatalogue = catalogue([{ ...p, freshness: { ...p.freshness, lastSuccessAt: new Date().toISOString() } }], [product], []);
  const saved = normalizeUserRateScenario({ mortgage: { mode: 'refi', loanBalance: '100000', propertyValue: '200000', years: '25' },
    projections: { mortgage: { holdVariableRate: true, horizonYears: '1' } } });
  const scope = { amount: '600000', lvr: '0.75', repayment: 'INTEREST_ONLY' };
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<PublicCostComparison section="Mortgage" target={row} scenario={saved} rateScenario={scope} />) as Tree; });
  try {
    const facts = tree.root.findAllByType('AppText').map(node => String(node.props.children));
    expect(facts).toContain('Loan amount: $600000');
    expect(facts).toContain('LVR: 75.0000%');
    expect(facts).toContain('Interest cost: $30000.00');
    expect(saved.mortgage.loanBalance).toBe('100000');
  } finally { act(() => tree.unmount()); }
});
