import React, { useMemo } from 'react';
import { View } from 'react-native';
import { AppText } from '../ui';
import { useStore } from '../../data/store';
import { scopedRateConditions, type ScopedRateConditions } from '../../data/rateConditions';
import type { RateRow, SectionKey } from '../../types';
import { scopedFinancialConditionFacts } from '../../data/scopedFinancialConditionFacts';
import { uiConditionFact } from '../../lib/financialUiCopy';
import { uiCount, uiIdentifier, uiJoin, uiLabel } from '../../lib/uiCopy';
import { FinancialFactRows } from './FinancialFactRows';

export function RateConditionsDisclosure({ model }: { model: ScopedRateConditions }) {
  const facts = scopedFinancialConditionFacts(model);
  return <View style={{ gap: 6 }}>
    <AppText variant="small" weight="600">{uiLabel("Conditions")}</AppText>
    <FinancialFactRows rows={facts.facts.map(uiConditionFact)} />
    <FinancialFactRows rows={[{ label: 'Eligibility', value: uiLabel('Unassessed') },
      ...(facts.state === 'unverified' ? [{ label: 'Source' as const, value: uiLabel('Unverified') }] : [])]} />
    {facts.unresolved.map((fact, index) => <View key={fact.source.conditionId} style={{ gap: 2 }}>
      <AppText variant="small" color="textMuted">{uiJoin('Source condition', ' ', uiCount(index + 1), ' · ', 'Source review required')}</AppText>
      <AppText variant="tiny" color="textFaint">{uiIdentifier(fact.source.sourcePointer)}</AppText>
    </View>)}
  </View>;
}
export function SelectedRateConditions({ row, section }: { row: RateRow; section: SectionKey }) {
  const core = useStore(s => s.core), details = useStore(s => s.details), manifest = useStore(s => s.manifest), coreIntegrity = useStore(s => s.coreIntegrity);
  const model = useMemo(() => scopedRateConditions(row, section, { core, details, manifest, coreIntegrity }), [row, section, core, details, manifest, coreIntegrity]);
  return <RateConditionsDisclosure model={model} />;
}
