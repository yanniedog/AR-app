import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import Compare from '../app/compare';
import { catalogue, core, product, programme } from '../testUtils/publicRateJourney';
import { captureRatesSession, restoreRatesSession, updateRatesSection } from '../src/data/ratesSession';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { useMortgageComparison, clearMortgageComparison } from '../src/data/mortgageComparison';
import { publicOfferSelectionToken } from '../src/data/publicOfferIdentity';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';

type Tree = ReactTestRenderer & { root: { findAllByType(type: string): { props: Record<string, any> }[] } };
let mockState: any;
let mockCatalogue: any;
let mockKeys: string;
jest.mock('../src/data/store', () => ({ useStore: (select: (state: any) => unknown) => select(mockState) }));
jest.mock('../src/data/publicRateCatalogue', () => ({ usePublicRateCatalogue: () => mockCatalogue }));
jest.mock('expo-router', () => ({ router: { back: jest.fn() }, useLocalSearchParams: () => ({ keys: mockKeys }) }));
jest.mock('../src/hooks/useUserRateScenario', () => ({ useUserRateScenario: () => ({ scenario: jest.requireActual('../src/data/userRateScenario').normalizeUserRateScenario(undefined) }) }));
jest.mock('../src/hooks/useSuitabilityRevision', () => ({ useSuitabilityRevision: () => 0 }));
jest.mock('../src/hooks/usePerformanceAuditReadiness', () => ({ usePerformanceAuditSurface: jest.fn() }));
jest.mock('../src/hooks/useLogoReadiness', () => ({ useLogoReadiness: () => ({ ready: true }) }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: {} }) }));
jest.mock('../src/components/Screen', () => ({ Screen: 'Screen' }));
jest.mock('../src/components/BankAvatar', () => ({ BankAvatar: 'BankAvatar' }));
jest.mock('../src/components/feedback', () => ({ EmptyState: 'EmptyState', ScreenSkeleton: 'ScreenSkeleton' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Badge: 'Badge', Button: 'Button', Card: 'Card', Divider: 'Divider', Row: 'Row' }));
jest.mock('../src/components/product/ComparisonDisclosures', () => ({ ComparisonDisclosures: 'Disclosures', PersonalCostComparisonDisclosure: 'CostDisclosure', publishedItemCount: () => '0' }));
jest.mock('../src/components/product/CanonicalTermsComparison', () => ({ CanonicalTermsComparison: 'CanonicalTermsComparison' }));
jest.mock('../src/components/product/FixedDepositComparison', () => ({ FixedDepositComparison: 'FixedDepositComparison' }));
jest.mock('../src/components/product/MortgageComparison', () => ({ MortgageComparison: 'MortgageComparison' }));
jest.mock('../src/components/product/PortfolioComparison', () => ({ PortfolioComparison: 'PortfolioComparison' }));
jest.mock('../src/components/product/ProductRateChangeLine', () => ({ ProductRateChangeLine: 'ProductRateChangeLine' }));
jest.mock('../src/components/product/RateConditionsDisclosure', () => ({ SelectedRateConditions: 'SelectedRateConditions' }));
jest.mock('../src/components/scenario/PublicRateEvidence', () => ({ PublicRateEvidence: 'PublicRateEvidence' }));
jest.mock('../src/components/scenario/PublicCostComparison', () => ({ PublicCostComparison: 'PublicCostComparison' }));

test('Compare retains amount/LVR eligibility and pricing for offers selected with ephemeral inputs', () => {
  const products = ['a', 'b'].map(id => ({ ...product, productId: id, productKey: id, name: id, programmeIds: [id] }));
  const programmes = products.map((item, index) => {
    const p = programme({ productId: item.productId, programmeId: item.productId, offerId: item.productId, sourceBindings: [], conditions: [
      { conditionId: 'amount', field: 'amount', operator: 'bounds', minimum: '500000', evidenceIds: [] },
      { conditionId: 'lvr', field: 'lvr', operator: 'bounds', maximum: '0.8', evidenceIds: [] },
    ] });
    return { ...p, freshness: { ...p.freshness, lastSuccessAt: new Date().toISOString() },
      components: [{ ...p.components[0], value: index ? '0.06' : '0.05', scopeId: item.productId }] };
  });
  mockCatalogue = { ...catalogue(programmes, products, []), loadAll: async () => undefined };
  mockState = { core: core([]), manifest: null, prefs: DEFAULT_PREFS, details: { products: {} }, ensureDetails: jest.fn() };
  mockKeys = JSON.stringify(products.map(item => publicOfferSelectionToken(item.productKey, item.productId)));
  installMandatoryEligibility(selectMandatoryEligibility(mockState.core, DEFAULT_PREFS.profileFilters, null));
  useMortgageComparison.setState({ loanAmount: '600000', lvr: '75' });
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<Compare />) as Tree; });
  try {
    expect(tree.root.findAllByType('EmptyState')).toHaveLength(0);
    const evidence = tree.root.findAllByType('PublicRateEvidence');
    expect(evidence).toHaveLength(2);
    expect(evidence.map(node => node.props.row.rate)).toEqual(['0.05', '0.06']);
    expect(evidence.every(node => node.props.scenario.amount === '600000' && node.props.scenario.lvr === '0.75')).toBe(true);
    expect(tree.root.findAllByType('PublicCostComparison').every(node => node.props.rateScenario.amount === '600000' && node.props.rateScenario.lvr === '0.75')).toBe(true);
    act(() => useMortgageComparison.setState({ loanAmount: '400000' }));
    expect(tree.root.findAllByType('EmptyState')).toHaveLength(1);
    expect(tree.root.findAllByType('PublicRateEvidence')).toHaveLength(0);
  } finally {
    act(() => { tree.unmount(); clearMortgageComparison(); });
    installMandatoryEligibility(selectMandatoryEligibility(null, DEFAULT_PREFS.profileFilters, null));
  }
});

test.each([false, true])('Compare evidence and costs retain each selected offer scope with multiple chips: %s', multiple => {
  const previous = captureRatesSession();
  const products = ['a', 'b'].map(id => ({ ...product, productId: id, productKey: id, name: id, programmeIds: [id] }));
  const programmes = products.map((item, index) => {
    const p = programme({ productId: item.productId, programmeId: item.productId, offerId: item.productId, sourceBindings: [], conditions: [
      { conditionId: 'purpose', field: 'purpose', operator: 'eq', value: multiple && index === 0 ? 'OWNER_OCCUPIED' : 'INVESTMENT', evidenceIds: [] },
      { conditionId: 'repayment', field: 'repayment', operator: 'eq', value: multiple && index === 0 ? 'PRINCIPAL_AND_INTEREST' : 'INTEREST_ONLY', evidenceIds: [] },
    ] });
    return { ...p, freshness: { ...p.freshness, lastSuccessAt: new Date().toISOString() }, components: [{ ...p.components[0], scopeId: item.productId }] };
  });
  mockCatalogue = { ...catalogue(programmes, products, []), loadAll: async () => undefined };
  mockState = { core: core([]), manifest: null, prefs: DEFAULT_PREFS, details: { products: {} }, ensureDetails: jest.fn() };
  mockKeys = JSON.stringify(products.map(item => publicOfferSelectionToken(item.productKey, item.productId)));
  installMandatoryEligibility(selectMandatoryEligibility(mockState.core, DEFAULT_PREFS.profileFilters, null));
  updateRatesSection('Mortgage', current => ({ filters: { ...current.filters, loanPurposes: multiple ? ['OO', 'INV'] : ['INVESTMENT'], repaymentTypes: multiple ? ['PI', 'IO'] : ['INTEREST_ONLY'] } }));
  let tree!: Tree;
  act(() => { tree = TestRenderer.create(<Compare />) as Tree; });
  try {
    expect(tree.root.findAllByType('EmptyState')).toHaveLength(0);
    const evidence = tree.root.findAllByType('PublicRateEvidence');
    expect(evidence).toHaveLength(2);
    const scopes = evidence.map(node => [node.props.scenario.purpose, node.props.scenario.repayment]);
    expect(scopes).toEqual(multiple ? [['OWNER_OCCUPIED', 'PRINCIPAL_AND_INTEREST'], ['INVESTMENT', 'INTEREST_ONLY']] : [['INVESTMENT', 'INTEREST_ONLY'], ['INVESTMENT', 'INTEREST_ONLY']]);
    expect(tree.root.findAllByType('PublicCostComparison').map(node => [node.props.rateScenario.purpose, node.props.rateScenario.repayment])).toEqual(scopes);
  } finally {
    act(() => { tree.unmount(); restoreRatesSession(previous); });
    installMandatoryEligibility(selectMandatoryEligibility(null, DEFAULT_PREFS.profileFilters, null));
  }
});
