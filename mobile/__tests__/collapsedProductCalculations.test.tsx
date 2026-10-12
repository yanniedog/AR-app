import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { EligibilityAssessment } from '../src/components/product/EligibilityAssessment';
import { SavingsPeriodCalculation } from '../src/components/product/SavingsPeriodCalculation';
import { ActivityPeriodCalculation } from '../src/components/product/ActivityPeriodCalculation';
import { MortgagePeriodCalculation } from '../src/components/product/MortgagePeriodCalculation';
import { FixedDepositCalculation } from '../src/components/product/FixedDepositCalculation';
import { canonical } from '../src/lib/productTermsEngine/validation';
import type { RateRow } from '../src/types';

const mockState = { manifest: { run_date: '2026-10-13' }, core: null, coreIntegrity: null,
  details: null, ensureDetails: jest.fn() };
jest.mock('../src/data/store', () => ({ useStore: (select: (state: typeof mockState) => unknown) => select(mockState) }));
jest.mock('../src/components/ui', () => ({ Disclosure: 'Disclosure', AppText: 'AppText', Button: 'Button' }));
jest.mock('../src/lib/productTermsEngine/validation', () => {
  const actual = jest.requireActual('../src/lib/productTermsEngine/validation');
  return { ...actual, canonical: jest.fn(actual.canonical) };
});
jest.mock('../src/components/product/SavingsPeriodForm', () => ({ SavingsPeriodForm: 'SavingsPeriodForm' }));
jest.mock('../src/components/product/ActivityPeriodForm', () => ({ ActivityPeriodForm: 'ActivityPeriodForm' }));
jest.mock('../src/components/product/MortgagePeriodForm', () => ({ MortgagePeriodForm: 'MortgagePeriodForm' }));
jest.mock('../src/components/product/EligibilityScenarioFields', () => ({ EligibilityScenarioFields: 'EligibilityScenarioFields' }));
jest.mock('../src/components/CustomerProfilePanel', () => ({ CustomerAnswerEditor: 'CustomerAnswerEditor' }));
jest.mock('../src/components/product/DepositCriteria', () => ({ ReviewedCriteria: 'ReviewedCriteria' }));
jest.mock('../src/components/product/DepositCohorts', () => ({ DepositCohorts: 'DepositCohorts' }));
jest.mock('../src/hooks/useCustomerProfile', () => ({ useCustomerProfile: () => ({ profile: null, busy: false }) }));

test('opening product details does no publication hashing for collapsed criteria and calculation controls', () => {
  const row: RateRow = { provider: 'A', product_key: 'loan', product_name: 'Loan', rate: '0.06' };
  jest.mocked(canonical).mockClear();
  let tree!: ReactTestRenderer;
  act(() => { tree = TestRenderer.create(<>
    <EligibilityAssessment productKey="loan" row={row} section="Mortgage" />
    <SavingsPeriodCalculation productKey="loan" row={row} section="Mortgage" />
    <ActivityPeriodCalculation productKey="loan" row={row} section="Mortgage" />
    <MortgagePeriodCalculation productKey="loan" row={row} section="Mortgage" />
    <FixedDepositCalculation row={row} />
  </>); });
  expect(canonical).not.toHaveBeenCalled();
  act(() => tree.update(<MortgagePeriodCalculation productKey="loan" row={row} section="Mortgage" />));
  expect(canonical).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
