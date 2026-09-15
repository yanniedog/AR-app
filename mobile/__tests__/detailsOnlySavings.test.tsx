import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { DetailsOnlyProduct } from '../src/components/product/DetailsOnlyProduct';
let mockCatalogue: any;
jest.mock('../src/hooks/useDetailsCatalogue', () => ({ useDetailsCatalogue: () => mockCatalogue }));
jest.mock('expo-router', () => ({ Stack: { Screen: 'StackScreen' } }));
jest.mock('../src/components/Screen', () => ({ ScreenScrollView: 'ScreenScrollView' }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button' }));
jest.mock('../src/components/product/ProductDetailParts', () => ({ DetailGroup: 'DetailGroup', OfficialLinks: 'OfficialLinks', ProductFacts: 'ProductFacts' }));
jest.mock('../src/components/product/ProductTermsDisclosure', () => ({ ProductTermsDisclosure: 'ProductTermsDisclosure' }));
jest.mock('../src/components/product/EligibilityAssessment', () => ({ EligibilityAssessment: 'EligibilityAssessment' }));
jest.mock('../src/components/product/SavingsPeriodCalculation', () => ({ SavingsPeriodCalculation: 'SavingsPeriodCalculation' }));
test.each(['HOME_LOANS', undefined, 'TRANS_AND_SAVINGS_ACCOUNTS'])('details-only calculator uses only explicit source category %s', async productCategory => {
  mockCatalogue = { details: { products: { product: { displayIdentity: { name: 'Savings named mortgage', ...(productCategory ? { productCategory } : {}) } } } }, manifest: { run_date: '2026-09-15' }, loading: false, retry: jest.fn() };
  let tree: any; await act(async () => { tree = TestRenderer.create(<DetailsOnlyProduct productKey="product" />); });
  expect(tree.root.findAllByType('SavingsPeriodCalculation')).toHaveLength(productCategory === 'TRANS_AND_SAVINGS_ACCOUNTS' ? 1 : 0);
});
