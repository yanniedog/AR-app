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

const dollars = (value?: string) => value == null ? 'Unavailable' : `$${Number(value).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
    return { estimate: bridge.scenario ? estimatePublicCost(rate, bridge.scenario) : undefined,
      reasons: bridge.reasonCodes, assumptions: bridge.assumptions };
  }, [target, catalogue, section, scenario, profile, details]);
  if (!result) return null;
  const estimate = result.estimate;
  const summary = estimate ? `${estimate.completeness === 'complete' ? 'Complete under stated assumptions' : estimate.completeness} · ${estimate.requestedDays != null ? `${estimate.projectedDays ?? 0} of ${estimate.requestedDays} days` : `${estimate.projectedMonths} of ${estimate.requestedMonths} months`}`
    : 'Cost calculation: terms or assumptions missing';
  return <View style={{ marginBottom: 16 }}><Disclosure title="Estimated cost or return" summary={summary} open={open} onToggle={() => setOpen(value => !value)}>
    <View style={{ gap: 6 }}>
      <AppText variant="small" weight="700">{target.provider} · {target.product_name}</AppText>
      <AppText variant="tiny" color="textMuted">Interest basis: payable nominal rate · Comparison rate: separate metric · Inputs: local assumptions · Charged rate: unverified</AppText>
      {estimate?.interest != null ? <AppText variant="small">{section === 'Mortgage' ? 'Interest cost' : 'Interest earned'}: {dollars(estimate.interest)}</AppText> : null}
      {estimate?.knownFees != null ? <AppText variant="small">Known fees: {dollars(estimate.knownFees)}</AppText> : null}
      {estimate?.knownCostSubtotal != null ? <AppText variant="small">Interest and known-fee subtotal: {dollars(estimate.knownCostSubtotal)}</AppText> : null}
      {estimate?.knownReturnSubtotal != null ? <AppText variant="small">Known return subtotal: {dollars(estimate.knownReturnSubtotal)}</AppText> : null}
      {estimate?.principalRepaid != null ? <AppText variant="small">Principal repaid: {dollars(estimate.principalRepaid)}</AppText> : null}
      {estimate?.endingBalance != null ? <AppText variant="small">Ending {section === 'Mortgage' ? 'loan balance' : 'balance'}: {dollars(estimate.endingBalance)}</AppText> : null}
      {estimate?.completeness !== 'complete' ? <AppText variant="tiny" color="textMuted">Subtotal: incomplete · Missing fees: unknown · Complete-cost ranking: unavailable · Verified savings: unavailable</AppText> : null}
      {[...new Set([...result.reasons, ...(estimate?.reasonCodes ?? [])])].map(reason => <AppText variant="tiny" color="textMuted" key={reason}>{publicRateReason(reason)}</AppText>)}
      {[...result.assumptions, ...(estimate?.assumptions ?? [])].map((assumption, index) => <AppText variant="tiny" color="textMuted" key={index}>{assumption}</AppText>)}
    </View>
  </Disclosure></View>;
}
