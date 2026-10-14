import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, Chip, Disclosure } from '../ui';
import type { RateRow } from '../../types';
import type { useCustomerProfile } from '../../hooks/useCustomerProfile';
import type { ApprovedSelection } from '../../data/executableContracts/transport';
import { depositEligibility, type DepositInputs } from '../../data/executableContracts/instantiate';
import { DepositCriteria, criteriaStatus } from './DepositCriteria';
import { uiLabel, uiDate, uiIdentifier, uiJoin } from '../../lib/uiCopy';
import { DepositInputFields } from './DepositInputFields';

export function DepositCohorts({ candidates, selectedId, onSelect, row, inputs, onChange, customer, shared = false }: {
  candidates: ApprovedSelection[]; selectedId: string | null; onSelect: (id: string) => void;
  row: RateRow; inputs: DepositInputs; onChange: (inputs: DepositInputs) => void;
  customer: ReturnType<typeof useCustomerProfile>; shared?: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!customer.profile) return null;
  const assessed = candidates.map(selection => ({ selection, eligibility: depositEligibility(selection, inputs, customer.profile!) }));
  const overlapping = assessed.filter(item => item.eligibility.status === 'meets').length > 1;
  return <View style={{ gap: 8 }}>
    {candidates.length > 1 && <AppText variant="small">{uiJoin('Customer group', ' · ', 'No approval')}</AppText>}
    {overlapping && <AppText variant="small">{uiLabel("Overlapping groups")}</AppText>}
    {assessed.map(({ selection, eligibility }) => {
      const t = selection.template, chosen = selectedId === t.id;
      return <View key={t.id} style={{ gap: 6 }}>
        <Chip label={uiJoin('Customer group', ' ', uiIdentifier(t.cohortKey), ' / ', 'Tier', ' ', uiIdentifier(t.tierKey), ' / ', 'Package', ' ', uiIdentifier(t.packageKey))} selected={chosen} onPress={() => onSelect(t.id)} />
        <AppText variant="small">{uiJoin('Criteria', ': ', criteriaStatus(eligibility.status), ' · ', 'No approval')}</AppText>
        <Disclosure title="Criteria" open={openId === t.id || candidates.length === 1} onToggle={() => setOpenId(openId === t.id ? null : t.id)}>
          <AppText variant="small">{uiJoin('Effective from', ' ', uiDate(t.effectiveFrom), ' · ', 'Effective to', ' ', uiDate(t.effectiveToExclusive), ' · ', 'End excluded')}</AppText>
          <DepositCriteria selection={selection} trace={eligibility.trace} />
          <DepositInputFields selection={selection} row={row} inputs={inputs} onChange={onChange} customer={customer} shared={shared} />
        </Disclosure>
      </View>;
    })}
  </View>;
}
