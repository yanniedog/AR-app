import React from 'react';
import { View } from 'react-native';

import { formatRate } from '../../data/format';
import type { UserRateScenario } from '../../data/userRateScenario';
import { selectedDepositCalculation, type CalculationTarget } from '../../lib/calculationTarget';
import type { RateConditionContext } from '../../data/rateConditions';
import { selectedTargetConstraint, selectedTargetConstraintLabel, targetConstraintContradicted, type SelectedTargetConstraint } from '../../lib/selectedTargetConstraints';
import { AppText, Row } from '../ui';

export function SelectedCalculationTarget({ target, scenario, identityOnly = false, constraint: suppliedConstraint, rateConditionContext }: {
  target: CalculationTarget;
  scenario: UserRateScenario;
  identityOnly?: boolean;
  constraint?: SelectedTargetConstraint;
  rateConditionContext?: RateConditionContext;
}) {
  if (target.status === 'none') return null;
  if (target.status !== 'available') return <AppText color="textMuted">
    {target.status === 'pending' ? 'Loading selected rate…' : 'Selected rate unavailable'}
  </AppText>;
  const { row, section } = target;
  const constraint = suppliedConstraint ?? selectedTargetConstraint(row, section, scenario, rateConditionContext);
  const deposit = identityOnly || section === 'Mortgage' ? null : selectedDepositCalculation(row, section, scenario, rateConditionContext);
  return <View style={{ gap: 4 }}>
    <AppText variant="small" color="textMuted">Selected rate</AppText>
    <AppText weight="600">{row.product_name}</AppText>
    <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <AppText variant="small" color="textMuted">{row.provider}</AppText>
      <AppText weight="600">{formatRate(row.rate)} advertised</AppText>
    </Row>
    <AppText variant="small" color={targetConstraintContradicted(constraint) ? 'warning' : 'textMuted'}>
      {selectedTargetConstraintLabel(constraint)}
    </AppText>
    {targetConstraintContradicted(constraint) ? <AppText variant="small" color="textMuted">Eligibility unverified</AppText> : null}
    {!identityOnly && deposit ? <View style={{ gap: 4, marginTop: 8 }}>
      <AppText>{deposit.status === 'ready'
        ? `$${Math.round(deposit.difference!).toLocaleString('en-AU')} interest difference`
        : deposit.status === 'inputs-required' ? 'Current balance and rate required' : 'Rate only'}</AppText>
      <AppText variant="small" color="textMuted">{deposit.basis === 'published-maturity'
        ? deposit.months ? `${deposit.months} month maturity` : 'Maturity unknown'
        : 'Annual simple interest'}</AppText>
      <AppText variant="small" color="textMuted">Fees, tax and compounding excluded</AppText>
    </View> : null}
  </View>;
}
