import React from 'react';
import { View } from 'react-native';

import { formatRate } from '../../data/format';
import type { UserRateScenario } from '../../data/userRateScenario';
import { selectedDepositCalculation, type CalculationTarget } from '../../lib/calculationTarget';
import type { RateConditionContext } from '../../data/rateConditions';
import { selectedTargetConstraint, targetConstraintContradicted, type SelectedTargetConstraint } from '../../lib/selectedTargetConstraints';
import { uiTargetConstraint } from '../../lib/financialUiCopy';
import { AppText, Row } from '../ui';
import { uiJoin, uiLabel, uiMoney, uiDuration, uiProductName, uiProviderName } from '../../lib/uiCopy';

export function SelectedCalculationTarget({ target, scenario, identityOnly = false, constraint: suppliedConstraint, rateConditionContext }: {
  target: CalculationTarget;
  scenario: UserRateScenario;
  identityOnly?: boolean;
  constraint?: SelectedTargetConstraint;
  rateConditionContext?: RateConditionContext;
}) {
  if (target.status === 'none') return null;
  if (target.status !== 'available') return <AppText color="textMuted">
    {uiLabel(target.status === 'pending' ? 'Loading selected rate…' : 'Selected rate unavailable')}
  </AppText>;
  const { row, section } = target;
  const constraint = suppliedConstraint ?? selectedTargetConstraint(row, section, scenario, rateConditionContext);
  const deposit = identityOnly || section === 'Mortgage' ? null : selectedDepositCalculation(row, section, scenario, rateConditionContext);
  return <View style={{ gap: 4 }}>
    <AppText variant="small" color="textMuted">{uiLabel('Selected rate')}</AppText>
    <AppText weight="600">{uiProductName(row)}</AppText>
    <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
      <AppText variant="small" color="textMuted">{uiProviderName(row)}</AppText>
      <AppText weight="600">{uiJoin(formatRate(row.rate), ' · ', 'Advertised')}</AppText>
    </Row>
    <AppText variant="small" color={targetConstraintContradicted(constraint) ? 'warning' : 'textMuted'}>
      {uiTargetConstraint(constraint)}
    </AppText>
    {targetConstraintContradicted(constraint) ? <AppText variant="small" color="textMuted">{uiLabel('Eligibility unverified')}</AppText> : null}
    {!identityOnly && deposit ? <View style={{ gap: 4, marginTop: 8 }}>
      <AppText>{deposit.status === 'ready'
        ? uiJoin(uiMoney(deposit.difference!), ' · ', 'Interest difference')
        : uiLabel(deposit.status === 'inputs-required' ? 'Current balance and rate required' : 'Rate only')}</AppText>
      <AppText variant="small" color="textMuted">{deposit.basis === 'published-maturity'
        ? deposit.months ? uiJoin(uiDuration(deposit.months, 'months'), ' · ', 'at maturity') : uiLabel('Maturity unknown')
        : uiLabel('Annual simple interest')}</AppText>
      <AppText variant="small" color="textMuted">{uiLabel('Fees, tax and compounding excluded')}</AppText>
    </View> : null}
  </View>;
}
