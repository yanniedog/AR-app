import { EMPTY_PROJECTION_INPUTS } from '../data/projectionScenario';
import type { UserRateScenario } from '../data/userRateScenario';

/** Complete, restorable inputs for audit callbacks, independent of prior edits. */
export function prepareProjectionAuditScenario(current: UserRateScenario): UserRateScenario {
  return {
    ...current,
    savings: { balance: '50000', currentRate: '4.50' },
    termDeposit: { balance: '50000', currentRate: '4.50' },
    localRates: {
      mortgage: { ...current.localRates.mortgage, mode: 'entered' },
      savings: { ...current.localRates.savings, mode: 'entered' },
      termDeposit: { ...current.localRates.termDeposit, mode: 'entered' },
    },
    projections: {
      mortgage: { ...EMPTY_PROJECTION_INPUTS, horizonYears: '3', holdVariableRate: true },
      savings: { ...EMPTY_PROJECTION_INPUTS, horizonYears: '1', holdVariableRate: true },
      termDeposit: { ...EMPTY_PROJECTION_INPUTS, termMonths: '12' },
    },
  };
}

/** Complete, restorable mortgage scenario for cold/warm projection route round-trip journeys. */
export function buildProjectionAuditJourneyScenario(current: UserRateScenario): UserRateScenario {
  const prepared = prepareProjectionAuditScenario(current);
  return {
    ...prepared,
    mortgage: {
      ...prepared.mortgage,
      mode: 'refi',
      propertyValue: '850000',
      loanBalance: '600000',
      currentRate: '6.40',
      years: '28',
    },
    projections: {
      ...prepared.projections,
      mortgage: {
        ...prepared.projections.mortgage,
        mortgageRateStructure: 'variable',
        lowerRate: '5.40',
        higherRate: '7.40',
        offsetBalance: '25000',
      },
    },
  };
}
