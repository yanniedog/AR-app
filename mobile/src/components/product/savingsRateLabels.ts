import { Decimal } from '../../lib/productTermsEngine/decimal';
import type { SavingsSubject } from '../../data/monetaryContracts/types';
import { uiDecimal, uiJoin, type UiText } from '../../lib/uiCopy';
export function savingsRateLabel(period: Pick<SavingsSubject['policy']['intervals'][number], 'tiers' | 'allocation'>, index: number): UiText {
  const upper = period.tiers[index].upperInclusive, lower = index ? period.tiers[index - 1].upperInclusive : '0';
  return uiJoin(period.allocation === 'marginal' ? 'Marginal tier' : 'Whole balance', ' · ', index ? '>' : '≥', uiDecimal(lower), upper === null ? null : uiJoin(' · ', '≤', uiDecimal(upper)));
}
export function savingsRatePercent(rate: string): UiText {
  return uiDecimal(Decimal.parse(rate).mul(Decimal.parse('100')).fixed(10).replace(/\.?0+$/, '') || '0', 'count');
}
