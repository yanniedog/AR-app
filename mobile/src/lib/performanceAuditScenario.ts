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
