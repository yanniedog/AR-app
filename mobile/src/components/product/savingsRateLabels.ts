import { Decimal } from '../../lib/productTermsEngine/decimal';
import type { SavingsSubject } from '../../data/monetaryContracts/types';
export function savingsRateLabel(period: Pick<SavingsSubject['policy']['intervals'][number], 'tiers' | 'allocation'>, index: number) {
  const upper = period.tiers[index].upperInclusive, lower = index ? period.tiers[index - 1].upperInclusive : '0';
  const range = index ? `over AUD ${lower}${upper === null ? '' : ` to AUD ${upper}`}` : upper === null ? 'all balances' : `AUD 0 to AUD ${upper}`;
  return `${period.allocation === 'marginal' ? 'Marginal tier' : 'Whole balance'}: ${range}`;
}
export function savingsRatePercent(rate: string) {
  return Decimal.parse(rate).mul(Decimal.parse('100')).fixed(10).replace(/\.?0+$/, '') || '0';
}
