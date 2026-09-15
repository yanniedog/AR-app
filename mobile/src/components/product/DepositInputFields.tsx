import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, Chip, Disclosure } from '../ui';
import { LedgerField } from '../ledger/LedgerField';
import { CustomerAnswerEditor } from '../CustomerProfilePanel';
import type { useCustomerProfile } from '../../hooks/useCustomerProfile';
import { Decimal } from '../../lib/productTermsEngine/decimal';
import type { RateRow } from '../../types';
import type { ApprovedSelection } from '../../data/executableContracts/transport';
import { depositInputRequirements, type DepositInputs } from '../../data/executableContracts/instantiate';

export const emptyDepositInputs = (): DepositInputs => ({ principal: '', confirmedAnnualRate: '', fundedDate: '', maturityDate: '', confirmed: false, confirmedAt: null, noWithholdingConfirmed: false });
export function annualRateFromPercent(text: string): string {
  const rate = Decimal.parse(text).div(Decimal.parse('100')), encoded = rate.fixed(12);
  if (rate.compare(Decimal.parse(encoded)) !== 0 || rate.compare(Decimal.parse('0')) < 0) throw new Error('Rate precision unsupported');
  return encoded;
}
function ConfirmedRateField({ inputs, onChange }: { inputs: DepositInputs; onChange: (inputs: DepositInputs) => void }) {
  const [text, setText] = useState(() => inputs.confirmedAnnualRate ? Decimal.parse(inputs.confirmedAnnualRate).mul(Decimal.parse('100')).fixed(10).replace(/\.?0+$/, '') : '');
  return <LedgerField label="Bank-confirmed annual rate (%)" hint="Enter the rate on your bank confirmation" value={text} keyboardType="decimal-pad" onChangeText={value => {
    setText(value); let confirmedAnnualRate = ''; try { confirmedAnnualRate = annualRateFromPercent(value); } catch { /* Invalid text cannot confirm a rate. */ }
    onChange({ ...inputs, confirmedAnnualRate, confirmed: false, confirmedAt: null });
  }} />;
}
export function DepositInputFields({ selection, row, inputs, onChange, customer, shared = false }: {
  selection: ApprovedSelection; row: RateRow; inputs: DepositInputs; onChange: (inputs: DepositInputs) => void;
  customer: ReturnType<typeof useCustomerProfile>; shared?: boolean;
}) {
  const { profile, busy, error, update } = customer;
  const [savedOpen, setSavedOpen] = useState(false);
  if (!profile) return <AppText variant="small">{error ?? 'Opening encrypted local inputs...'}</AppText>;
  const requirements = depositInputRequirements(selection, inputs, profile);
  return <View style={{ gap: 12 }}>
    {!shared && <LedgerField label="Deposit amount (AUD)" value={inputs.principal} keyboardType="decimal-pad" onChangeText={principal => onChange({ ...inputs, principal, confirmed: false })} />}
    {!shared && <LedgerField label="Bank-confirmed funding date" hint="YYYY-MM-DD" value={inputs.fundedDate} onChangeText={fundedDate => onChange({ ...inputs, fundedDate, confirmed: false })} />}
    <LedgerField label="Bank-confirmed maturity date" hint="YYYY-MM-DD" value={inputs.maturityDate} onChangeText={maturityDate => onChange({ ...inputs, maturityDate, confirmed: false })} />
    <ConfirmedRateField inputs={inputs} onChange={onChange} />
    <Chip label="Bank agreed this amount, rate and these dates" selected={inputs.confirmed} onPress={() => onChange({ ...inputs, confirmed: !inputs.confirmed, confirmedAt: !inputs.confirmed ? new Date().toISOString() : null })} />
    <Chip label="No withholding applies to this payout" selected={inputs.noWithholdingConfirmed} onPress={() => onChange({ ...inputs, noWithholdingConfirmed: !inputs.noWithholdingConfirmed })} />
    {requirements.needed.map(d => <CustomerAnswerEditor key={d.id} definition={d} productKey={row.product_key} answer={profile.answers[d.id]} disabled={busy} onSave={answer => void update(p => ({ ...p, definitions: { ...p.definitions, [d.id]: d }, answers: { ...p.answers, [d.id]: answer } }))} />)}
    {!!requirements.deferred.length && <AppText variant="small">Unresolved answers: {requirements.deferred.map(d => d.label).join(', ')}. Change them in saved answers when available.</AppText>}
    <Disclosure title="Saved eligibility answers" open={savedOpen} onToggle={() => setSavedOpen(!savedOpen)}>
      {requirements.saved.map(d => <CustomerAnswerEditor key={d.id} definition={d} productKey={row.product_key} answer={profile.answers[d.id]} disabled={busy} onSave={answer => void update(p => ({ ...p, answers: { ...p.answers, [d.id]: answer } }))} />)}
    </Disclosure>
    {error ? <AppText variant="small">{error}</AppText> : null}
  </View>;
}
