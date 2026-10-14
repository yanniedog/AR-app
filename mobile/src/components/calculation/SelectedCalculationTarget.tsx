import React from 'react';
import { View } from 'react-native';

import { formatRate } from '../../data/format';
import type { UserRateScenario } from '../../data/userRateScenario';
import { selectedDepositCalculation, type CalculationTarget } from '../../lib/calculationTarget';
import { AppText, Row } from '../ui';

export function SelectedCalculationTarget({ target, scenario, identityOnly = false }: {
  target: CalculationTarget;
  scenario: UserRateScenario;
  identityOnly?: boolean;
}) {
  if (target.status === 'none') return null;
  if (target.status !== 'available') return <AppText color="textMuted">
    {target.status === 'pending' ? 'Loading selected rate…' : 'Selected rate unavailable'}
  </AppText>;
  const { row, section } = target;
  const deposit = section === 'Mortgage' ? null : selectedDepositCalculation(row, section, scenario);
  return <View style={{ gap: 4 }}>
    <AppText variant="small" color="textMuted">Selected rate</AppText>
    <AppText weight="600">{row.product_name}</AppText>
    <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <AppText variant="small" color="textMuted">{row.provider}</AppText>
      <AppText weight="600">{formatRate(row.rate)} advertised</AppText>
    </Row>
    {!identityOnly && deposit ? <View style={{ gap: 4, marginTop: 8 }}>
      <AppText>{deposit.status === 'ready'
        ? `$${Math.round(deposit.difference!).toLocaleString('en-AU')} interest difference`
        : deposit.status === 'inputs-required' ? 'Current balance and rate required' : 'Rate only'}</AppText>
      <AppText variant="small" color="textMuted">{deposit.basis === 'published-maturity'
        ? deposit.months ? `${deposit.months} month maturity` : 'Maturity unknown'
        : 'Annual simple interest'}</AppText>
      <AppText variant="small" color="textMuted">Fees, tax and compounding excluded</AppText>
      <AppText variant="small" color="textMuted">Eligibility unverified</AppText>
    </View> : null}
  </View>;
}
