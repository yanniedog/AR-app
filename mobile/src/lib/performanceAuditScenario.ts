import { EMPTY_PROJECTION_INPUTS } from '../data/projectionScenario';
import type { UserRateScenario } from '../data/userRateScenario';

/** Complete, restorable inputs for audit callbacks, independent of prior edits. */
export function prepareProjectionAuditScenario(current: UserRateScenario): UserRateScenario {
  return {
    ...current,
    savings: { balance: '50000', currentRate: '4.50' },
    termDeposit: { balance: '50000', currentRate: '4.50' },
    projections: {
      mortgage: { ...EMPTY_PROJECTION_INPUTS },
      savings: { ...EMPTY_PROJECTION_INPUTS, horizonYears: '5' },
      termDeposit: { ...EMPTY_PROJECTION_INPUTS, termMonths: '12' },
    },
  };
}
