import React from 'react';
import { View } from 'react-native';

// Closed facts emitted alongside projection simulations.
import type { ProjectionCashflowSnapshot, ProjectionFact, ProjectionFrequency, ProjectionSeriesId } from '../../data/projectionFacts';
import { AppText, Row } from '../ui';
import { uiCount, uiDate, uiDuration, uiJoin, uiLabel, uiMoney, uiRate, type UiCopy } from '../../lib/uiCopy';

const FREQUENCY = { weekly: 'Weekly', fortnightly: 'Fortnightly', monthly: 'Monthly' } as const satisfies Record<ProjectionFrequency, string>;
const SCENARIO = {
  'rate-lower': 'Lower rate', 'rate-base': 'Base rate', 'rate-higher': 'Higher rate',
  'offset-none': 'No offset', 'offset-steady': 'Current offset', 'offset-plan': 'Offset plan', 'offset-boost': 'Offset boost',
} as const satisfies Record<ProjectionSeriesId, string>;
const HORIZON = { 'full-term': 'Remaining term', 'fixed-period': 'Fixed period', 'savings-horizon': 'Savings horizon', 'deposit-maturity': 'Deposit maturity' } as const;

function CashflowRows({ label, amount, enteredAmount, enteredFrequency, annualPeriods }: {
  label: UiCopy; amount: number;
} & Omit<ProjectionCashflowSnapshot, 'monthlyAmount'>) {
  return <View style={{ gap: 4 }}>
    <Row><AppText variant="small" color="textMuted">{label}</AppText><AppText variant="small">{uiJoin(uiMoney(enteredAmount, 2),' · ',FREQUENCY[enteredFrequency])}</AppText></Row>
    <Row><AppText variant="small" color="textMuted">{uiLabel('Monthly equivalent')}</AppText><AppText variant="small">{uiJoin(uiMoney(amount, 2),' / ','month')}</AppText></Row>
    {annualPeriods !== 12 ? <Row><AppText variant="small" color="textMuted">{uiLabel('Conversion')}</AppText><AppText variant="small">{uiJoin(uiCount(annualPeriods),' / ',uiCount(12))}</AppText></Row> : null}
  </View>;
}

function renderFact(fact: ProjectionFact): React.ReactElement {
  switch (fact.kind) {
    case 'projection-basis': return <Row><AppText variant="small" color="textMuted">{uiLabel("Basis")}</AppText><AppText variant="small">{uiLabel("Illustrative · No forecast")}</AppText></Row>;
    case 'projection-horizon': return <Row><AppText variant="small" color="textMuted">{HORIZON[fact.scope]}</AppText><AppText variant="small">{uiDuration(fact.months,"months")}</AppText></Row>;
    case 'remaining-term': return <Row><AppText variant="small" color="textMuted">{uiLabel("Remaining term")}</AppText><AppText variant="small">{uiDuration(fact.years,"years")}</AppText></Row>;
    case 'savings-horizon-years': return <Row><AppText variant="small" color="textMuted">{uiLabel("Savings horizon")}</AppText><AppText variant="small">{uiDuration(fact.years,"years")}</AppText></Row>;
    case 'rate-scenarios': return <View style={{ gap: 4 }}>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Lower / base / higher")}</AppText><AppText variant="small">{uiRate(fact.lowerFraction)}{uiLabel("/")}{uiRate(fact.baseFraction)}{uiLabel("/")}{uiRate(fact.higherFraction)}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Scenario rates")}</AppText><AppText variant="small">{uiLabel("Constant")}</AppText></Row>
    </View>;
    case 'monthly-repayment': return <View style={{ gap: 4 }}>
      {fact.source === 'entered' ? <CashflowRows label="Repayment" {...fact}/> : <Row><AppText variant="small" color="textMuted">{uiLabel('Monthly repayment')}</AppText><AppText variant="small">{uiJoin(uiMoney(fact.amount, 2),' / ','month')}</AppText></Row>}
      <Row><AppText variant="small" color="textMuted">{uiLabel("Repayment basis")}</AppText><AppText variant="small">{uiLabel(fact.source==='entered'?'Entered':'Illustrative')}</AppText></Row>
    </View>;
    case 'monthly-extra-repayment': return <CashflowRows label="Extra repayment" {...fact}/>;
    case 'offset-model': return <View style={{ gap: 4 }}>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Opening offset")}</AppText><AppText variant="small">{uiJoin(uiMoney(fact.openingAmount),' · ',fact.openingSource==='entered'?'Entered':'Simulated history')}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Offset basis")}</AppText><AppText variant="small">{uiLabel("Interest reduction")}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Offset as repayment")}</AppText><AppText variant="small">{uiLabel("Excluded")}</AppText></Row>
    </View>;
    case 'monthly-offset-contribution': return <View style={{ gap: 4 }}>
      <CashflowRows label="Offset contribution" {...fact}/>
      <CashflowRows label="Offset boost" {...fact} amount={fact.boostAmount} enteredAmount={fact.enteredBoostAmount}/>
    </View>;
    case 'net-offset-difference': return <View style={{ gap: 4 }}>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Net offset difference")}</AppText><AppText variant="small">{uiLabel("Unavailable")}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Offset fees")}</AppText><AppText variant="small">{uiLabel("Unverified")}</AppText></Row>
    </View>;
    case 'future-reversion-rate': return <Row><AppText variant="small" color="textMuted">{uiLabel("Reversion rate")}</AppText><AppText variant="small">{uiLabel("Unknown")}</AppText></Row>;
    case 'history-model': return <View style={{ gap: 4 }}>
      <Row><AppText variant="small" color="textMuted">{uiLabel("History")}</AppText><AppText variant="small">{uiLabel("Approximate")}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Starting date")}</AppText><AppText variant="small">{uiDate(fact.anchorDay)}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Starting balance / rate")}</AppText><AppText variant="small">{uiMoney(fact.anchorBalance)}{uiLabel("/")}{uiRate(fact.anchorRateFraction)}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Re-anchor")}</AppText><AppText variant="small">{uiLabel("Current entered balance")}</AppText></Row>
    </View>;
    case 'history-activity': return <View style={{ gap: 4 }}>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Past rate / payment changes")}</AppText><AppText variant="small">{uiLabel("Unknown")}</AppText></Row>
      {fact.offsetChanges === 'unknown' ? <Row><AppText variant="small" color="textMuted">{uiLabel("Past offset changes")}</AppText><AppText variant="small">{uiLabel("Unknown")}</AppText></Row> : null}
      {fact.depositTerm === 'repeated-input' ? <Row><AppText variant="small" color="textMuted">{uiLabel("Historical term / maturity")}</AppText><AppText variant="small">{uiLabel("Repeated inputs")}</AppText></Row> : null}
    </View>;
    case 'history-balance-mismatch': return <View style={{ gap: 4 }}>
      <Row><AppText variant="small" color="danger">{uiLabel("History balance mismatch")}</AppText><AppText variant="small">{uiMoney(fact.differenceAmount)}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Simulated / entered balance")}</AppText><AppText variant="small">{uiMoney(fact.simulatedEndAmount)}{uiLabel("/")}{uiMoney(fact.currentEnteredAmount)}</AppText></Row>
    </View>;
    case 'history-offset-mismatch': return <View style={{ gap: 4 }}>
      <Row><AppText variant="small" color="danger">{uiLabel("History offset mismatch")}</AppText><AppText variant="small">{uiMoney(fact.differenceAmount)}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Simulated / entered offset")}</AppText><AppText variant="small">{uiMoney(fact.simulatedEndAmount)}{uiLabel("/")}{uiMoney(fact.currentEnteredAmount)}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Forward offset")}</AppText><AppText variant="small">{uiLabel("Simulated history")}</AppText></Row>
    </View>;
    case 'negative-amortisation': return <View style={{ gap: 4 }}>
      <AppText variant="small" color="danger">{uiLabel("Loan growth · Interest exceeds repayment")}</AppText>
      {fact.scenarios.map(id => <AppText key={id} variant="small">{SCENARIO[id]}</AppText>)}
    </View>;
    case 'residual-loan-balance': return <View style={{ gap: 4 }}>
      <AppText variant="small" color="danger">{uiLabel("Balance at term end")}</AppText>
      {fact.scenarios.map(item => <Row key={item.id}><AppText variant="small" color="textMuted">{SCENARIO[item.id]}</AppText><AppText variant="small">{uiMoney(item.amount)}</AppText></Row>)}
    </View>;
    case 'monthly-contribution': return <CashflowRows label="Contribution" {...fact}/>;
    case 'monthly-withdrawal': return <CashflowRows label="Withdrawal" {...fact}/>;
    case 'deposit-interest-model': return <View style={{ gap: 4 }}>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Interest accrual / payment")}</AppText><AppText variant="small">{uiLabel("Monthly nominal / maturity")}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Provider day count / payment timing")}</AppText><AppText variant="small">{uiLabel("Unverified")}</AppText></Row>
    </View>;
    case 'deposit-interest-treatment': return <Row><AppText variant="small" color="textMuted">{uiLabel("Interest at maturity")}</AppText><AppText variant="small">{fact.value === 'reinvest-at-maturity' ? uiLabel("Reinvested") : uiJoin('Paid out',' · ','Balance',' · ','Excluded')}</AppText></Row>;
    case 'deposit-term': return <Row><AppText variant="small" color="textMuted">{uiLabel("Deposit term / rate")}</AppText><AppText variant="small">{uiJoin(uiDuration(fact.months,'months'),' / ',uiRate(fact.currentRateFraction))}</AppText></Row>;
    case 'deposit-rollovers': return <View style={{ gap: 4 }}>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Rollovers")}</AppText><AppText variant="small">{uiJoin(uiCount(fact.count),' · ','Scenario rate')}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Renewal rate")}</AppText><AppText variant="small">{uiLabel("Unknown")}</AppText></Row>
    </View>;
    case 'savings-interest-model': return <View style={{ gap: 4 }}>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Compounding")}</AppText><AppText variant="small">{uiLabel("Monthly")}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Provider timing / bonus eligibility")}</AppText><AppText variant="small">{uiLabel("Unverified")}</AppText></Row>
    </View>;
    case 'savings-bonus-model': return <View style={{ gap: 4 }}>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Bonus conditions")}</AppText><AppText variant="small">{uiJoin('Entered',' · ',fact.conditions === 'entered-met' ? 'Meets' : 'Does not meet')}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Bonus period")}</AppText><AppText variant="small">{uiDuration(fact.periodMonths,'months')}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Conditional / ongoing rate")}</AppText><AppText variant="small">{uiRate(fact.conditionalRateFraction)}{uiLabel("/")}{uiRate(fact.ongoingRateFraction)}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Starting rate")}</AppText><AppText variant="small">{uiLabel(fact.startingRate === 'conditional' ? 'Conditional rate' : 'Ongoing rate')}</AppText></Row>
    </View>;
    case 'projection-exclusions': return <View style={{ gap: 4 }}>
      <Row><AppText variant="small" color="textMuted">{uiLabel("Tax")}</AppText><AppText variant="small">{uiLabel("Excluded")}</AppText></Row>
      <Row><AppText variant="small" color="textMuted">{uiLabel('Actual future rate changes')}</AppText><AppText variant="small">{uiLabel("Unknown")}</AppText></Row>
    </View>;
  }
  const unhandled: never = fact;
  void unhandled;
  throw new Error('Unhandled projection fact');
}

/** Accepts producer facts only; no string-to-fact or arbitrary label factory. */
export function ProjectionFactRows({ facts }: { facts: readonly ProjectionFact[] }) {
  return <View style={{ gap: 8 }}>{facts.map((fact, index) => <View key={`${fact.kind}:${index}`}>{renderFact(fact)}</View>)}</View>;
}
