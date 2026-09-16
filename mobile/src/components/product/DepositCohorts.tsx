import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, Chip, Disclosure } from '../ui';
import type { RateRow } from '../../types';
import type { useCustomerProfile } from '../../hooks/useCustomerProfile';
import type { ApprovedSelection } from '../../data/executableContracts/transport';
import { depositEligibility, type DepositInputs } from '../../data/executableContracts/instantiate';
import { DepositCriteria } from './DepositCriteria';
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
    {candidates.length > 1 && <AppText variant="small">Choose the reviewed customer group on your bank confirmation. Criteria are assessed separately; they do not confirm a bank offer.</AppText>}
    {overlapping && <AppText variant="small">More than one group meets the recorded criteria. No group is chosen automatically; confirm the applicable group explicitly.</AppText>}
    {assessed.map(({ selection, eligibility }) => {
      const t = selection.template, chosen = selectedId === t.id;
      return <View key={t.id} style={{ gap: 6 }}>
        <Chip label={`Choose ${t.cohortKey} / ${t.tierKey} / ${t.packageKey}`} selected={chosen} onPress={() => onSelect(t.id)} />
        <AppText variant="small">Criteria: {eligibility.status.replace(/_/g, ' ')}. Reviewed source terms; not bank approval.</AppText>
        <Disclosure title={`Review ${t.cohortKey}`} open={openId === t.id || candidates.length === 1} onToggle={() => setOpenId(openId === t.id ? null : t.id)}>
          <AppText variant="small">Effective {t.effectiveFrom} to {t.effectiveToExclusive} (end excluded). Amount/rate/term checks also apply.</AppText>
          <DepositCriteria selection={selection} trace={eligibility.trace} />
          <DepositInputFields selection={selection} row={row} inputs={inputs} onChange={onChange} customer={customer} shared={shared} />
        </Disclosure>
      </View>;
    })}
  </View>;
}
