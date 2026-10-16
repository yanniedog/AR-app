import { formatRate } from '../data/format';
import { rateConditionalFacts, type ConditionalRateFact, type RateConditionality } from '../data/rateConditionalFacts';
import { uiConditionalRateFacts } from './financialUiCopy';
import { uiLabel, type UiText } from './uiCopy';
import type { RateRow, SectionKey } from '../types';
export { rateConditionality } from '../data/rateConditionalFacts';
export type { RateConditionality } from '../data/rateConditionalFacts';

export interface RateQualifier {
  kind: RateConditionality;
  conditional: boolean;
  introMonths: number | null;
  ongoingRate: UiText | null;
  shortLabel: UiText;
  label: UiText;
  facts: readonly ConditionalRateFact[];
}
export function rateQualifier(row: RateRow, section: SectionKey): RateQualifier {
  const model = rateConditionalFacts(row, section);
  const period = model.facts.find(fact => fact.kind === 'intro-period');
  const ongoing = model.facts.find(fact => fact.kind === 'ongoing-rate');
  const label = uiConditionalRateFacts(model);
  return { kind: model.kind, conditional: model.conditional,
    introMonths: period?.kind === 'intro-period' && period.state === 'known' ? period.months : null,
    ongoingRate: ongoing?.kind === 'ongoing-rate' && ongoing.state === 'known' ? formatRate(ongoing.fraction) : null,
    shortLabel: model.conditional ? label : uiLabel(''), label, facts: model.facts };
}
