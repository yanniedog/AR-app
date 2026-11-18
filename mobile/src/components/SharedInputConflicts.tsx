import React from 'react';
import { View } from 'react-native';
import { useCustomerProfile } from '../hooks/useCustomerProfile';
import { withInput, type SharedInputPath } from '../data/customerInputState';
import { calculatorAmount, MAX_CALCULATOR_MORTGAGE_AMOUNT } from '../data/calc';
import { uiJoin, uiMoney, uiNumber, uiRate, type UiCopy } from '../lib/uiCopy';
import { AppText, Button, Row } from './ui';

const labels: Record<SharedInputPath, UiCopy> = {
  'mortgage.propertyValue': 'Property value', 'mortgage.loanBalance': 'Loan balance', 'mortgage.currentRate': 'Current rate',
  'mortgage.deposit': 'Deposit', 'mortgage.costs': 'Upfront costs', 'mortgage.years': 'Years remaining',
  'savings.balance': 'Savings balance', 'savings.currentRate': 'Savings rate',
  'termDeposit.balance': 'Term deposit balance', 'termDeposit.currentRate': 'Term deposit rate',
  'projections.mortgage.offsetBalance': 'Offset balance',
};
function fact(path: SharedInputPath, value: string): UiCopy {
  if (path.endsWith('Rate')) return uiRate(Number(value) / 100);
  if (path.endsWith('years')) return uiNumber(Number(value));
  return uiMoney(calculatorAmount(value, MAX_CALCULATOR_MORTGAGE_AMOUNT));
}
/** One-time selection preserves both original records; no values need retyping. */
export function SharedInputConflicts() {
  const { profile, busy, update } = useCustomerProfile();
  const conflict = profile?.inputState?.conflicts[0];
  if (!conflict) return null;
  const path = conflict.path as SharedInputPath;
  const choose = (incoming: boolean) => void update(current => {
    if (!current.inputState) return current;
    const value = current.inputState.conflicts[0];
    if (!value || value.path !== conflict.path || value.current !== conflict.current || value.incoming !== conflict.incoming) return current;
    return { ...current, inputState: { ...current.inputState,
      scenario: incoming ? withInput(current.inputState.scenario, path, value.incoming) : current.inputState.scenario,
      conflicts: current.inputState.conflicts.slice(1),
    } };
  });
  return <View style={{ gap: 8 }}>
    <AppText weight="700">{uiJoin('Choose saved value', ' · ', labels[path])}</AppText>
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      <Button title={uiJoin('Keep current', ' · ', fact(path, conflict.current))} disabled={busy} variant="secondary" onPress={() => choose(false)} />
      <Button title={uiJoin('Use saved', ' · ', fact(path, conflict.incoming))} disabled={busy} variant="secondary" onPress={() => choose(true)} />
    </Row>
  </View>;
}
