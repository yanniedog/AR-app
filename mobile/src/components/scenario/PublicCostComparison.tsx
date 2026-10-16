import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import type { RateRow, SectionKey } from '../../types';
import type { UserRateScenario } from '../../data/userRateScenario';
import { useStore } from '../../data/store';
import { usePublicRateCatalogue } from '../../data/publicRateCatalogue';
import { bindCurrentPublicRow, publicRateScenario, resolveRowPublicRate } from '../../data/publicRateIntegration';
import { scenarioPublicCost } from '../../data/scenarioPublicCost';
import { estimatePublicCost } from '../../data/publicCost';
import { publicRateReason } from '../../data/publicRatePresentation';
import { AppText, Disclosure } from '../ui';
import { uiCount, uiDecimal, uiJoin, uiLabel, uiOpaqueEnum, uiProductName, uiProviderName, type UiCopy } from '../../lib/uiCopy';

/** Closed presentation of deterministic model assumptions, never provider prose. */
function assumptionFact(value: string) {
  const facts: Record<string, UiCopy> = {
    'Variable/reference rates: held at selected levels': uiJoin('Variable rate held', ': ', 'Yes'),
    'Published rate phases: applied': uiJoin('Rate phases', ': ', 'Included'),
    'Current rate: local numerical input': uiJoin('Current rate', ': ', 'Entered'),
    'Accrual: monthly nominal': uiJoin('Accrual', ': ', 'Monthly nominal'),
    'Repayments: month end': uiJoin('Repayments', ': ', 'Month end'),
    'Rounding: cents each month': uiJoin('Rounding', ': ', 'Cents', ' / ', 'month'),
    'Offset: constant, less offset-funded fees': uiJoin('Offset', ': ', 'Constant', ' · ', 'Offset-funded fees', ': ', 'Included'),
    'Financed upfront fees: included in principal and LVR': uiJoin('Financed upfront fees', ': ', 'Principal', ' / ', 'LVR', ' · ', 'Included'),
    'Pricing eligibility: revalidated after financing': uiJoin('Eligibility', ': ', 'Revalidated after financing'),
    'Savings qualification: conflicts with projected cash flows': uiJoin('Bonus qualification', ': ', 'Cash-flow conflict'),
    'Qualifying deposits/withdrawal counts: explicit inputs': uiJoin('Bonus qualification', ': ', 'Entered'),
    'Interest basis: actual days/365': uiJoin('Interest basis', ': ', 'Actual days/365'),
    'Interest basis: monthly nominal': uiJoin('Interest basis', ': ', 'Monthly nominal'),
    'Cash flows: month boundaries': uiJoin('Cash flows', ': ', 'Month boundaries'),
    'Projection end: quoted maturity': uiJoin('Projection horizon', ': ', 'Quoted maturity'),
    'Projection end: quoted day maturity': uiJoin('Projection horizon', ': ', 'Quoted maturity'),
    'Renewal rate: unavailable': uiJoin('Renewal rate', ': ', 'Unavailable'),
    'Term-deposit principal: fixed': uiJoin('Principal', ': ', 'Fixed'),
    'Periodic interest: paid outside deposit': uiJoin('Periodic interest', ': ', 'Paid outside deposit'),
    'Reinvestment return: excluded; local rate missing': uiJoin('Reinvestment return', ': ', 'Excluded', ' · ', 'Local renewal rate', ': ', 'Unknown'),
    'Charges: paid outside fixed deposit principal': uiJoin('Charges', ': ', 'Paid outside deposit'),
    'Recurring fees are charged at the start of each published frequency interval.': uiJoin('Recurring fees', ': ', 'Frequency interval start'),
    'Switching fees/cashback: local assumptions': uiJoin('Switch costs', ' / ', 'Cashback', ': ', 'Local', ' ', 'Assumptions'),
    'Unspecified costs: unknown': uiJoin('Missing fees', ': ', 'Unknown'),
    'Quoted principal: fixed until maturity': uiJoin('Principal', ': ', 'Fixed', ' · ', 'Quoted maturity'),
    'Reinvestment/renewal rates: separate local assumptions': uiJoin('Renewal rate', ': ', 'Local', ' ', 'Assumptions'),
  };
  return uiJoin(facts[value] ?? uiLabel('Source review required'));
}

export function PublicCostComparison({ section, target, scenario }: { section: SectionKey; target: RateRow; scenario: UserRateScenario }) {
  const manifest = useStore(state => state.manifest);
  const profile = useStore(state => state.prefs?.profileFilters);
  const details = useStore(state => state.details?.products);
  const catalogue = usePublicRateCatalogue(manifest);
  const [open, setOpen] = useState(false);
  const result = useMemo(() => {
    const row = bindCurrentPublicRow(target, catalogue);
    const selectedScenario = publicRateScenario(section, scenario, profile, row);
    const rate = resolveRowPublicRate(row, catalogue, selectedScenario);
    if (!rate) return undefined;
    const product = catalogue.getProduct(row.product_key);
    const programme = product ? catalogue.getProgrammes(product.productId).find(item => item.programmeId === row.public_programme_id) : undefined;
    const key = section === 'Mortgage' ? 'mortgage' : section === 'TD' ? 'termDeposit' : 'savings';
    const bridge = scenarioPublicCost({ section, scenario, row, programme, rateScenario: selectedScenario,
      targetDetail: details?.[row.product_key], currentDetail: details?.[scenario.currentProducts?.[key]?.productKey ?? ''] });
    return { estimate: bridge.scenario ? estimatePublicCost(rate, bridge.scenario) : undefined, reasons: bridge.reasonCodes, assumptions: bridge.assumptions };
  }, [target, catalogue, section, scenario, profile, details]);
  if (!result) return null;
  const estimate = result.estimate;
  return <View style={{ marginBottom: 16 }}><Disclosure title="Cost / return" open={open} onToggle={() => setOpen(value => !value)}>
    <View style={{ gap: 6 }}>
      <AppText variant="small" weight="700">{uiJoin(uiProviderName(target), ' · ', uiProductName(target))}</AppText>
      <AppText variant="small">{uiJoin('Costs', ': ', estimate?.completeness === 'complete' ? 'Complete under assumptions' : estimate ? uiOpaqueEnum(estimate.completeness.toUpperCase()) : 'Unavailable')}</AppText>
      <AppText variant="tiny" color="textMuted">{uiJoin('Interest basis', ': ', 'Payable nominal rate', ' · ', 'Comparison rate', ': ', 'Excluded', ' · ', 'Charged rate', ': ', 'Unverified')}</AppText>
      {estimate ? <AppText variant="tiny">{uiJoin('Projection horizon', ': ', uiCount(estimate.requestedDays != null ? estimate.projectedDays ?? 0 : estimate.projectedMonths), ' ', 'of', ' ', uiCount(estimate.requestedDays ?? estimate.requestedMonths), ' ', estimate.requestedDays != null ? 'days' : 'months')}</AppText> : null}
      {estimate?.interest != null ? <AppText variant="small">{uiJoin(section === 'Mortgage' ? 'Interest cost' : 'Interest earned', ': ', uiDecimal(estimate.interest))}</AppText> : null}
      {estimate?.knownFees != null ? <AppText variant="small">{uiJoin('Known fees', ': ', uiDecimal(estimate.knownFees))}</AppText> : null}
      {estimate?.knownCostSubtotal != null ? <AppText variant="small">{uiJoin('Interest + known fees', ': ', uiDecimal(estimate.knownCostSubtotal))}</AppText> : null}
      {estimate?.knownReturnSubtotal != null ? <AppText variant="small">{uiJoin('Known return', ': ', uiDecimal(estimate.knownReturnSubtotal))}</AppText> : null}
      {estimate?.principalRepaid != null ? <AppText variant="small">{uiJoin('Principal repaid', ': ', uiDecimal(estimate.principalRepaid))}</AppText> : null}
      {estimate?.endingBalance != null ? <AppText variant="small">{uiJoin('Ending balance', ': ', uiDecimal(estimate.endingBalance))}</AppText> : null}
      {estimate?.completeness !== 'complete' ? <AppText variant="tiny" color="textMuted">{uiJoin('Missing fees', ': ', 'Unknown', ' · ', 'Complete-cost ranking', ': ', 'Unavailable', ' · ', 'Verified savings', ': ', 'Unavailable')}</AppText> : null}
      {[...new Set([...result.reasons, ...(estimate?.reasonCodes ?? [])])].map(reason => <AppText variant="tiny" color="textMuted" key={reason}>{publicRateReason(reason)}</AppText>)}
      {[...new Set([...result.assumptions, ...(estimate?.assumptions ?? [])])].map(assumption => <AppText variant="tiny" color="textMuted" key={assumption}>{assumptionFact(assumption)}</AppText>)}
    </View>
  </Disclosure></View>;
}
