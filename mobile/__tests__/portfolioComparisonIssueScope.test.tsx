import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { EngineReceiptFacts } from '../src/components/product/EngineReceiptFacts';
import { receiptIssueFacts } from '../src/lib/engineReceiptFactModel';
import { evaluateEligibility } from '../src/lib/productTermsEngine/eligibility';
import { calculateLedger } from '../src/lib/productTermsEngine/ledger';
import { comparePortfolios } from '../src/lib/productTermsEngine/portfolioComparison';
import { example } from '../src/lib/productTermsEngine/testSupport';
import type { Rule } from '../src/lib/productTermsEngine/types';
import type { PortfolioInput } from '../src/lib/productTermsEngine/portfolioTypes';

jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Row: 'Row' }));

test('the eligibility comparison reason is already disclosed by the account receipt renderer', () => {
  // Deliberately exercise the evaluator's runtime validation branch.
  const rule = { id: 'comparison-test', op: 'compare', field: 'qualification', comparison: 'unsupported',
    expected: { type: 'boolean', value: true }, evidenceIds: [] } as unknown as Rule;
  const eligibility = evaluateEligibility(rule, { qualification: { type: 'boolean', value: true } });
  expect(eligibility.reasons).toEqual(['comparison_unsupported']);
  const { contract, scenario } = example();
  const receipt = { ...calculateLedger(contract, scenario), issues: eligibility.reasons, eligibility };
  expect(receiptIssueFacts(receipt)[0].code).toBe('comparison_unsupported');
  let tree!: ReactTestRenderer & { toJSON(): unknown };
  act(() => { tree = TestRenderer.create(<EngineReceiptFacts receipt={receipt} />) as typeof tree; });
  try { expect(JSON.stringify(tree.toJSON())).toContain('comparison_unsupported'); }
  finally { act(() => tree.unmount()); }
});

test('incomplete portfolio accounts produce the recognised top-level material-input issue', () => {
  const { scenario } = example();
  const input: PortfolioInput = { schemaVersion: 1, frame: { id: 'frame', currency: 'AUD', startDate: scenario.startDate,
    endDateExclusive: scenario.endDateExclusive, timezone: 'Australia/Hobart', settlement: 'same_civil_day',
    valuation: 'holding_with_accrued_interest', openingNetWorth: '0', scopeCoverage: 'reviewed_complete',
    externalFlows: [], externalFeeFunding: 'outside_frame_cost_adjustment', allowConditional: false, metric: 'terminal_net_worth' },
    accounts: [], transfers: [], dependencyGraph: [], dependencyIds: [] };
  const result = comparePortfolios({ schemaVersion: 1, referenceId: 'reference', alternatives: [
    { id: 'reference', input }, { id: 'alternative', input },
  ] });
  expect(result.available).toBe(false);
  expect(result.issues).toEqual(['comparison_material_inputs_incomplete']);
  expect(result.issues).not.toContain('comparison_unsupported');
});
