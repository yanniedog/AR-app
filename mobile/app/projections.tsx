import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, TextInput, useWindowDimensions, View } from 'react-native';

import { LifecycleChart } from '../src/components/projections/LifecycleChart';
import { ScreenScrollView } from '../src/components/Screen';
import { CompactToggle, SegmentedControl } from '../src/components/controls';
import { AppText, Badge, Button, Card, Chip, Row } from '../src/components/ui';
import { computeLvr, type CalcInputs } from '../src/data/calc';
import type { ProjectionFrequency, ProjectionInputs } from '../src/data/projectionScenario';
import {
  buildLifecycleProjection,
  projectionMetricLabel,
  projectionCurrency,
  type ProjectionDimension,
  type ProjectionMetric,
} from '../src/data/projections';
import { useUserRateScenario } from '../src/hooks/useUserRateScenario';
import type { SectionKey } from '../src/types';
import { useTheme } from '../src/theme/ThemeProvider';
import { openBrowse } from '../src/lib/nav';

const SECTION_OPTIONS: { label: string; value: SectionKey }[] = [
  { label: 'Mortgage', value: 'Mortgage' },
  { label: 'Savings', value: 'Savings' },
  { label: 'Term deposit', value: 'TD' },
];

const FREQUENCY_OPTIONS: { label: string; value: ProjectionFrequency }[] = [
  { label: 'Weekly', value: 'weekly' },
  { label: 'Fortnightly', value: 'fortnightly' },
  { label: 'Monthly', value: 'monthly' },
];

function requestedSection(value: string | string[] | undefined): SectionKey {
  const first = Array.isArray(value) ? value[0] : value;
  return first === 'Savings' || first === 'TD' ? first : 'Mortgage';
}

function enteredNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[$,%\s,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function rateError(value: string, required: boolean): string | undefined {
  const parsed = enteredNumber(value);
  if (parsed == null) return required || value.trim() ? 'Enter a rate from 0% to 100%.' : undefined;
  return parsed < 0 || parsed > 100 ? 'Use a rate from 0% to 100%.' : undefined;
}

function positiveAmountError(value: string, label: string, required = false): string | undefined {
  const parsed = enteredNumber(value);
  if (parsed == null) return required || value.trim() ? `Enter ${label}.` : undefined;
  if (parsed <= 0) return `Enter ${label}.`;
  if (parsed > 1_000_000_000_000) return 'Use an amount no greater than $1 trillion.';
  return undefined;
}

function optionalAmountError(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const parsed = enteredNumber(value);
  if (parsed == null || parsed < 0 || parsed > 1_000_000_000_000) {
    return 'Use an amount from $0 to $1 trillion.';
  }
  return undefined;
}

function validPastIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value
    && parsed.getTime() < Date.now();
}

function NumericField({
  label,
  value,
  onChangeText,
  placeholder,
  prefix,
  suffix,
  date,
  editable = true,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  prefix?: string;
  suffix?: string;
  date?: boolean;
  editable?: boolean;
  error?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 160, minWidth: 0, gap: 5 }}>
      <AppText variant="tiny" color="textMuted" weight="700">{label}</AppText>
      <View
        style={{
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          backgroundColor: theme.colors.surfaceAlt,
          paddingHorizontal: 12,
        }}
      >
        {prefix ? <AppText color="textMuted">{prefix}</AppText> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textFaint}
          keyboardType={date ? 'numbers-and-punctuation' : 'decimal-pad'}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}
          accessibilityHint={error ?? `${prefix ?? ''}${suffix ? ` Value in ${suffix}.` : ''}`}
          accessibilityState={{ disabled: !editable }}
          editable={editable}
          maxLength={20}
          style={{
            flex: 1,
            minWidth: 0,
            color: theme.colors.text,
            fontSize: theme.font.body,
            paddingVertical: Platform.OS === 'android' ? 8 : 12,
          }}
        />
        {suffix ? <AppText variant="small" color="textMuted">{suffix}</AppText> : null}
      </View>
      {error ? (
        <AppText variant="tiny" color="danger" accessibilityLiveRegion="polite">{error}</AppText>
      ) : null}
    </View>
  );
}

function FrequencyField({
  label,
  value,
  amount,
  onAmount,
  onFrequency,
  editable = true,
  error,
}: {
  label: string;
  value: ProjectionFrequency;
  amount: string;
  onAmount: (value: string) => void;
  onFrequency: (value: ProjectionFrequency) => void;
  editable?: boolean;
  error?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      <NumericField label={label} value={amount} onChangeText={onAmount} placeholder="0" prefix="$" editable={editable} error={error} />
      <SegmentedControl options={FREQUENCY_OPTIONS} value={value} onChange={(next) => { if (editable) onFrequency(next); }} />
    </View>
  );
}

function ProjectionSummary({
  section,
  result,
}: {
  section: SectionKey;
  result: ReturnType<typeof buildLifecycleProjection>;
}) {
  const theme = useTheme();
  const base = result.rateSeries[1];
  if (!base) return null;
  const optimistic = result.rateSeries[0];
  const higher = result.rateSeries[2];
  const offsetBoost = result.offsetSeries.find((item) => item.id === 'offset-boost');
  const cards = section === 'Mortgage'
    ? [
      {
        label: result.projectionScope === 'fixed-period' ? 'Balance at fixed-period end' : 'Projected payoff',
        value: result.projectionScope === 'fixed-period'
          ? projectionCurrency(base.endBalance)
          : base.payoffDate ?? 'Balance remains',
        detail: `${projectionCurrency(base.projectedInterest)} forward modelled interest`,
      },
      { label: 'Higher-rate cost', value: projectionCurrency(Math.max(0, (higher?.totalInterest ?? 0) - base.totalInterest)), detail: 'extra interest versus current-rate scenario' },
      ...(offsetBoost ? [{ label: 'Boosted offset', value: projectionCurrency(Math.max(0, base.totalInterest - offsetBoost.totalInterest)), detail: 'modelled interest avoided versus your offset plan' }] : []),
    ]
    : [
      { label: section === 'TD' ? 'Total maturity value' : 'Projected balance', value: projectionCurrency(section === 'TD' ? base.totalValue : base.endBalance), detail: `${projectionCurrency(base.projectedInterest)} forward modelled interest` },
      { label: 'Lower-rate outcome', value: projectionCurrency(section === 'TD' ? optimistic?.totalValue ?? 0 : optimistic?.endBalance ?? 0), detail: `${((optimistic?.annualRate ?? 0) * 100).toFixed(2)}% scenario` },
      { label: 'Higher-rate outcome', value: projectionCurrency(section === 'TD' ? higher?.totalValue ?? 0 : higher?.endBalance ?? 0), detail: `${((higher?.annualRate ?? 0) * 100).toFixed(2)}% scenario` },
    ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {cards.map((item) => (
        <View
          key={item.label}
          style={{
            flexGrow: 1,
            flexBasis: 150,
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radius.md,
            backgroundColor: theme.colors.surfaceAlt,
            padding: 12,
            gap: 3,
          }}
        >
          <AppText variant="tiny" color="textFaint" weight="700">{item.label.toUpperCase()}</AppText>
          <AppText variant="body" weight="800">{item.value}</AppText>
          <AppText variant="tiny" color="textMuted">{item.detail}</AppText>
        </View>
      ))}
    </View>
  );
}

export default function Projections() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ section?: string }>();
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 860 && fontScale < 1.5;
  const [section, setSection] = useState<SectionKey>(() => requestedSection(params.section));
  const {
    scenario,
    storageStatus,
    saveStatus,
    error: storageError,
    update: updateScenario,
    flush,
    retryLoad,
  } = useUserRateScenario();
  const [advanced, setAdvanced] = useState(false);
  const [metric, setMetric] = useState<ProjectionMetric>('balance');
  const [dimension, setDimension] = useState<ProjectionDimension>('rates');

  useEffect(() => setSection(requestedSection(params.section)), [params.section]);

  const projectionKey = section === 'Mortgage' ? 'mortgage' : section === 'TD' ? 'termDeposit' : 'savings';
  const projectionInputs = scenario.projections[projectionKey];
  const updateProjection = (patch: Partial<ProjectionInputs>) => updateScenario((current) => ({
    ...current,
    projections: {
      ...current.projections,
      [projectionKey]: { ...current.projections[projectionKey], ...patch },
    },
  }));
  const updateMortgage = (patch: Partial<CalcInputs>) => updateScenario((current) => ({
    ...current,
    mortgage: { ...current.mortgage, ...patch },
  }));
  const updateDeposit = (patch: { balance?: string; currentRate?: string }) => updateScenario((current) => section === 'TD'
    ? { ...current, termDeposit: { ...current.termDeposit, ...patch } }
    : { ...current, savings: { ...current.savings, ...patch } });
  const deferredScenario = useDeferredValue(scenario);
  const result = useMemo(
    () => buildLifecycleProjection(section, deferredScenario),
    [deferredScenario, section],
  );
  useEffect(() => {
    setMetric(result.defaultMetric);
    if (section !== 'Mortgage') setDimension('rates');
  }, [result.defaultMetric, section]);

  const currentMortgageBalance = scenario.mortgage.mode === 'refi'
    ? scenario.mortgage.loanBalance
    : String(Math.round(computeLvr(scenario.mortgage).loan ?? 0) || '');
  const activeSeries = dimension === 'offsets' ? result.offsetSeries : result.rateSeries;
  const inputsEditable = storageStatus === 'ready';
  const currentRateText = section === 'Mortgage'
    ? scenario.mortgage.currentRate
    : section === 'TD'
      ? scenario.termDeposit.currentRate
      : projectionInputs.savingsRateStructure === 'conditional-bonus'
        ? projectionInputs.ongoingRate
        : scenario.savings.currentRate;
  const currentRateNumber = enteredNumber(currentRateText);
  const historyValues = [projectionInputs.startDate, projectionInputs.startBalance, projectionInputs.startRate];
  const hasHistoryInput = historyValues.some((value) => value.trim().length > 0);
  const startDateValid = validPastIsoDate(projectionInputs.startDate);
  const errors: Record<string, string | undefined> = {
    mortgageBalance: section === 'Mortgage' ? positiveAmountError(currentMortgageBalance, 'the current loan balance') : undefined,
    savingsBalance: section === 'Savings' ? positiveAmountError(scenario.savings.balance, 'the current balance') : undefined,
    tdBalance: section === 'TD' ? positiveAmountError(scenario.termDeposit.balance, 'the deposit amount') : undefined,
    currentRate: rateError(
      section === 'Mortgage' ? scenario.mortgage.currentRate : section === 'TD' ? scenario.termDeposit.currentRate : scenario.savings.currentRate,
      false,
    ),
    years: section === 'Mortgage' && scenario.mortgage.years.trim()
      && (!(enteredNumber(scenario.mortgage.years)! > 0) || enteredNumber(scenario.mortgage.years)! > 50)
      ? 'Use a remaining term above 0 and up to 50 years.'
      : undefined,
    fixedPeriod: projectionInputs.mortgageRateStructure === 'fixed'
      && (!(enteredNumber(projectionInputs.fixedPeriodMonths)! > 0)
        || enteredNumber(projectionInputs.fixedPeriodMonths)! > (enteredNumber(scenario.mortgage.years) ?? 0) * 12)
      ? 'Use a fixed period above 0 and no longer than the remaining loan term.'
      : undefined,
    horizon: section === 'Savings' && projectionInputs.horizonYears.trim()
      && (!(enteredNumber(projectionInputs.horizonYears)! > 0) || enteredNumber(projectionInputs.horizonYears)! > 50)
      ? 'Use a horizon above 0 and up to 50 years.'
      : undefined,
    ongoingRate: projectionInputs.savingsRateStructure === 'conditional-bonus'
      ? rateError(projectionInputs.ongoingRate, true)
      : undefined,
    bonusMonths: projectionInputs.savingsRateStructure === 'conditional-bonus'
      && (!Number.isInteger(enteredNumber(projectionInputs.bonusMonthsRemaining))
        || enteredNumber(projectionInputs.bonusMonthsRemaining)! < 0
        || enteredNumber(projectionInputs.bonusMonthsRemaining)! > 60)
      ? 'Use a whole-number bonus period from 0 to 60 months.'
      : undefined,
    termMonths: section === 'TD' && projectionInputs.termMonths.trim()
      && (!Number.isInteger(enteredNumber(projectionInputs.termMonths))
        || enteredNumber(projectionInputs.termMonths)! < 1
        || enteredNumber(projectionInputs.termMonths)! > 120)
      ? 'Use a whole-number term from 1 to 120 months.'
      : undefined,
    rollovers: section === 'TD'
      && (!Number.isInteger(enteredNumber(projectionInputs.rollovers))
        || enteredNumber(projectionInputs.rollovers)! < 0
        || enteredNumber(projectionInputs.rollovers)! > 10)
      ? 'Use a whole number from 0 to 10.'
      : undefined,
    startDate: hasHistoryInput && !startDateValid ? 'Use a valid past date in YYYY-MM-DD format.' : undefined,
    startBalance: hasHistoryInput ? positiveAmountError(projectionInputs.startBalance, 'a starting balance', true) : undefined,
    startRate: hasHistoryInput ? rateError(projectionInputs.startRate, true) : undefined,
    lowerRate: projectionInputs.lowerRate.trim()
      && (rateError(projectionInputs.lowerRate, false) || enteredNumber(projectionInputs.lowerRate)! > (currentRateNumber ?? -1))
      ? 'Use a rate from 0% up to the current or ongoing rate.'
      : undefined,
    higherRate: projectionInputs.higherRate.trim()
      && (rateError(projectionInputs.higherRate, false) || enteredNumber(projectionInputs.higherRate)! < (currentRateNumber ?? 101))
      ? 'Use a rate from the current or ongoing rate up to 100%.'
      : undefined,
    periodicAmount: optionalAmountError(projectionInputs.periodicAmount),
    withdrawalAmount: optionalAmountError(projectionInputs.withdrawalAmount),
    offsetBalance: optionalAmountError(projectionInputs.offsetBalance),
    startOffsetBalance: optionalAmountError(projectionInputs.startOffsetBalance),
    offsetContributionAmount: optionalAmountError(projectionInputs.offsetContributionAmount),
    offsetBoostAmount: optionalAmountError(projectionInputs.offsetBoostAmount),
    extraRepaymentAmount: optionalAmountError(projectionInputs.extraRepaymentAmount),
  };

  const basicFields = (
    <Card style={{ gap: 14 }}>
      <View>
        <AppText variant="h3">Start with today</AppText>
        <AppText variant="small" color="textMuted" style={{ marginTop: 3 }}>
          These values are shared with Today and Switch & save. Editing them updates your encrypted local scenario, not your browsing profile.
        </AppText>
      </View>
      {section === 'Mortgage' ? (
        <>
          <Row gap={10} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <NumericField
              label={scenario.mortgage.mode === 'buy' ? 'Calculated loan amount' : 'Current loan balance'}
              value={currentMortgageBalance}
              onChangeText={(loanBalance) => updateMortgage({ loanBalance })}
              placeholder="600,000"
              prefix="$"
              editable={inputsEditable && scenario.mortgage.mode !== 'buy'}
              error={errors.mortgageBalance}
            />
            <NumericField label="Current interest rate" value={scenario.mortgage.currentRate} onChangeText={(currentRate) => updateMortgage({ currentRate })} placeholder="6.00" suffix="%" editable={inputsEditable} error={errors.currentRate} />
            <NumericField label="Years remaining" value={scenario.mortgage.years} onChangeText={(years) => updateMortgage({ years })} placeholder="25" suffix="years" editable={inputsEditable} error={errors.years} />
          </Row>
          {scenario.mortgage.mode === 'buy' ? (
            <AppText variant="tiny" color="textMuted">
              Loan amount is calculated from the purchase details in Switch &amp; save. Edit those details there rather than silently changing this to a refinance scenario.
            </AppText>
          ) : null}
          <SegmentedControl
            options={[
              { label: 'Variable rate', value: 'variable' },
              { label: 'Fixed rate', value: 'fixed' },
            ]}
            value={projectionInputs.mortgageRateStructure}
            onChange={(mortgageRateStructure) => { if (inputsEditable) updateProjection({ mortgageRateStructure }); }}
          />
          {projectionInputs.mortgageRateStructure === 'fixed' ? (
            <NumericField
              label="Fixed period remaining"
              value={projectionInputs.fixedPeriodMonths}
              onChangeText={(fixedPeriodMonths) => updateProjection({ fixedPeriodMonths })}
              placeholder="12"
              suffix="months"
              editable={inputsEditable}
              error={errors.fixedPeriod}
            />
          ) : null}
          <FrequencyField
            label="Regular repayment"
            amount={projectionInputs.periodicAmount}
            value={projectionInputs.periodicFrequency}
            onAmount={(periodicAmount) => updateProjection({ periodicAmount })}
            onFrequency={(periodicFrequency) => updateProjection({ periodicFrequency })}
            editable={inputsEditable}
            error={errors.periodicAmount}
          />
          <Row gap={10} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <NumericField label="Current offset balance" value={projectionInputs.offsetBalance} onChangeText={(offsetBalance) => updateProjection({ offsetBalance })} placeholder="0" prefix="$" editable={inputsEditable} error={errors.offsetBalance} />
            <NumericField label="Amount added to offset" value={projectionInputs.offsetContributionAmount} onChangeText={(offsetContributionAmount) => updateProjection({ offsetContributionAmount })} placeholder="0" prefix="$" editable={inputsEditable} error={errors.offsetContributionAmount} />
          </Row>
          <SegmentedControl
            options={FREQUENCY_OPTIONS}
            value={projectionInputs.offsetContributionFrequency}
            onChange={(offsetContributionFrequency) => { if (inputsEditable) updateProjection({ offsetContributionFrequency }); }}
          />
        </>
      ) : section === 'Savings' ? (
        <>
          <Row gap={10} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <NumericField label="Current balance" value={scenario.savings.balance} onChangeText={(balance) => updateDeposit({ balance })} placeholder="25,000" prefix="$" editable={inputsEditable} error={errors.savingsBalance} />
            <NumericField label={projectionInputs.savingsRateStructure === 'conditional-bonus' ? 'Current conditional rate' : 'Current interest rate'} value={scenario.savings.currentRate} onChangeText={(currentRate) => updateDeposit({ currentRate })} placeholder="4.50" suffix="%" editable={inputsEditable} error={errors.currentRate} />
            <NumericField label="Projection horizon" value={projectionInputs.horizonYears} onChangeText={(horizonYears) => updateProjection({ horizonYears })} placeholder="10" suffix="years" editable={inputsEditable} error={errors.horizon} />
          </Row>
          <SegmentedControl
            options={[
              { label: 'Ongoing rate', value: 'ongoing' },
              { label: 'Conditional bonus', value: 'conditional-bonus' },
            ]}
            value={projectionInputs.savingsRateStructure}
            onChange={(savingsRateStructure) => { if (inputsEditable) updateProjection({ savingsRateStructure }); }}
          />
          {projectionInputs.savingsRateStructure === 'conditional-bonus' ? (
            <>
              <Row gap={10} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <NumericField label="Ongoing rate" value={projectionInputs.ongoingRate} onChangeText={(ongoingRate) => updateProjection({ ongoingRate })} placeholder="1.50" suffix="%" editable={inputsEditable} error={errors.ongoingRate} />
                <NumericField label="Bonus period remaining" value={projectionInputs.bonusMonthsRemaining} onChangeText={(bonusMonthsRemaining) => updateProjection({ bonusMonthsRemaining })} placeholder="4" suffix="months" editable={inputsEditable} error={errors.bonusMonths} />
              </Row>
              <CompactToggle
                label="I expect to meet the bonus conditions"
                value={projectionInputs.bonusConditionsMet}
                onChange={(bonusConditionsMet) => { if (inputsEditable) updateProjection({ bonusConditionsMet }); }}
              />
            </>
          ) : null}
          <FrequencyField
            label="Regular contribution"
            amount={projectionInputs.periodicAmount}
            value={projectionInputs.periodicFrequency}
            onAmount={(periodicAmount) => updateProjection({ periodicAmount })}
            onFrequency={(periodicFrequency) => updateProjection({ periodicFrequency })}
            editable={inputsEditable}
            error={errors.periodicAmount}
          />
        </>
      ) : (
        <>
          <Row gap={10} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <NumericField label="Deposit amount" value={scenario.termDeposit.balance} onChangeText={(balance) => updateDeposit({ balance })} placeholder="50,000" prefix="$" editable={inputsEditable} error={errors.tdBalance} />
            <NumericField label="Fixed interest rate" value={scenario.termDeposit.currentRate} onChangeText={(currentRate) => updateDeposit({ currentRate })} placeholder="4.50" suffix="%" editable={inputsEditable} error={errors.currentRate} />
            <NumericField label="Term" value={projectionInputs.termMonths} onChangeText={(termMonths) => updateProjection({ termMonths })} placeholder="12" suffix="months" editable={inputsEditable} error={errors.termMonths} />
          </Row>
        </>
      )}
      <Pressable
        onPress={() => setAdvanced((value) => !value)}
        accessibilityRole="button"
        accessibilityLabel={advanced ? 'Hide optional projection assumptions' : 'Show optional projection assumptions'}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="700">Optional history and scenarios</AppText>
          <AppText variant="tiny" color="textMuted">Add only what is relevant to your product</AppText>
        </View>
        <Ionicons name={advanced ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.primary} />
      </Pressable>
    </Card>
  );

  const advancedFields = advanced ? (
    <Card style={{ gap: 14 }}>
      <View>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="h3">Approximate history</AppText>
          <Badge label="optional" tone="muted" />
        </Row>
        <AppText variant="small" color="textMuted" style={{ marginTop: 3 }}>
          Enter all three anchors to estimate progress before today. This is not a statement history and will show any mismatch with your current balance.
        </AppText>
      </View>
      <Row gap={10} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <NumericField label="Starting date" value={projectionInputs.startDate} onChangeText={(startDate) => updateProjection({ startDate })} placeholder="2021-08-04" date editable={inputsEditable} error={errors.startDate} />
        <NumericField label="Starting balance" value={projectionInputs.startBalance} onChangeText={(startBalance) => updateProjection({ startBalance })} placeholder="700,000" prefix="$" editable={inputsEditable} error={errors.startBalance} />
        <NumericField label="Starting rate" value={projectionInputs.startRate} onChangeText={(startRate) => updateProjection({ startRate })} placeholder="3.50" suffix="%" editable={inputsEditable} error={errors.startRate} />
      </Row>
      {section === 'Mortgage' ? (
        <>
          <NumericField label="Starting offset balance" value={projectionInputs.startOffsetBalance} onChangeText={(startOffsetBalance) => updateProjection({ startOffsetBalance })} placeholder="0" prefix="$" editable={inputsEditable} error={errors.startOffsetBalance} />
          <FrequencyField
            label="Extra repayment"
            amount={projectionInputs.extraRepaymentAmount}
            value={projectionInputs.extraRepaymentFrequency}
            onAmount={(extraRepaymentAmount) => updateProjection({ extraRepaymentAmount })}
            onFrequency={(extraRepaymentFrequency) => updateProjection({ extraRepaymentFrequency })}
            editable={inputsEditable}
            error={errors.extraRepaymentAmount}
          />
          <NumericField
            label="Boosted-offset scenario adds another"
            value={projectionInputs.offsetBoostAmount}
            onChangeText={(offsetBoostAmount) => updateProjection({ offsetBoostAmount })}
            placeholder="100"
            prefix="$"
            suffix={`/${projectionInputs.offsetContributionFrequency === 'monthly' ? 'month' : projectionInputs.offsetContributionFrequency === 'weekly' ? 'week' : 'fortnight'}`}
            editable={inputsEditable}
            error={errors.offsetBoostAmount}
          />
        </>
      ) : section === 'Savings' ? (
        <FrequencyField
          label="Regular withdrawal"
          amount={projectionInputs.withdrawalAmount}
          value={projectionInputs.withdrawalFrequency}
          onAmount={(withdrawalAmount) => updateProjection({ withdrawalAmount })}
          onFrequency={(withdrawalFrequency) => updateProjection({ withdrawalFrequency })}
          editable={inputsEditable}
          error={errors.withdrawalAmount}
        />
      ) : (
        <>
          <NumericField label="Rollovers after first maturity" value={projectionInputs.rollovers} onChangeText={(rollovers) => updateProjection({ rollovers })} placeholder="0" editable={inputsEditable} error={errors.rollovers} />
          <CompactToggle label="Reinvest modelled interest" value={projectionInputs.reinvestInterest} onChange={(reinvestInterest) => { if (inputsEditable) updateProjection({ reinvestInterest }); }} />
        </>
      )}
      <View style={{ height: 1, backgroundColor: theme.colors.border }} />
      <View>
        <AppText variant="body" weight="700">Future interest-rate range</AppText>
        <AppText variant="tiny" color="textMuted" style={{ marginTop: 3 }}>
          Leave blank to use one percentage point below and above your current rate.
        </AppText>
      </View>
      <Row gap={10} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <NumericField label="Lower scenario" value={projectionInputs.lowerRate} onChangeText={(lowerRate) => updateProjection({ lowerRate })} placeholder="auto" suffix="%" editable={inputsEditable} error={errors.lowerRate} />
        <NumericField label="Higher scenario" value={projectionInputs.higherRate} onChangeText={(higherRate) => updateProjection({ higherRate })} placeholder="auto" suffix="%" editable={inputsEditable} error={errors.higherRate} />
      </Row>
    </Card>
  ) : null;

  const chartCard = (
    <Card style={{ gap: 14 }}>
      <View>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <AppText variant="h3">Your lifecycle projection</AppText>
            <AppText variant="small" color="textMuted" style={{ marginTop: 3 }}>
              From {result.history.length > 1 ? 'your optional starting point' : 'today'} through the modelled end date
            </AppText>
          </View>
          <Badge label="Illustrative · free beta" tone="primary" />
        </Row>
      </View>
      {!result.ready ? (
        <View style={{ gap: 12 }}>
          <AppText variant="body" color="textMuted">
            Fix or add {result.missing.join(', ')} above to build this projection.
          </AppText>
          <Button
            title="Use Switch & save details"
            variant="secondary"
            onPress={() => { void flush().then((saved) => { if (saved) router.push('/calculator'); }); }}
          />
        </View>
      ) : (
        <>
          {section === 'Mortgage' ? (
            <SegmentedControl
              options={[
                { label: 'Rate scenarios', value: 'rates' },
                { label: 'Offset scenarios', value: 'offsets' },
              ]}
              value={dimension}
              onChange={setDimension}
            />
          ) : null}
          <View>
            <AppText variant="tiny" color="textFaint" weight="700" style={{ marginBottom: 8 }}>Y-AXIS</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {result.availableMetrics.map((item) => (
                <Chip key={item} label={projectionMetricLabel(section, item)} selected={metric === item} onPress={() => setMetric(item)} />
              ))}
            </View>
          </View>
          <LifecycleChart section={section} history={result.history} series={activeSeries} metric={metric} asAt={result.asAt} />
          <ProjectionSummary section={section} result={result} />
        </>
      )}
    </Card>
  );

  return (
    <ScreenScrollView keyboardShouldPersistTaps="handled">
      <Card style={{ gap: 8, borderColor: `${theme.colors.primary}55` }}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <AppText variant="h2">See the whole financial journey</AppText>
            <AppText variant="body" color="textMuted" style={{ marginTop: 5 }}>
              Explore approximate history and forward scenarios without changing your saved product profile or implying a forecast.
            </AppText>
          </View>
          <Ionicons name="analytics-outline" size={32} color={theme.colors.primary} />
        </Row>
        <AppText variant="tiny" color="textFaint">
          {Platform.OS === 'web'
            ? 'On web, these amounts stay only in this tab and disappear when it closes. Session replay is blocked on this screen.'
            : 'Your amounts stay in encrypted local storage on this device. Session replay is blocked on this screen.'}
        </AppText>
      </Card>
      {storageStatus !== 'ready' || saveStatus === 'saving' || saveStatus === 'saved' || storageError ? (
        <Card style={{ gap: 8 }}>
          <AppText variant="small" weight="700">
            {storageStatus === 'loading' || storageStatus === 'idle'
              ? 'Loading encrypted scenario...'
              : saveStatus === 'saving'
                ? 'Saving encrypted scenario...'
                : saveStatus === 'saved'
                  ? 'Encrypted scenario saved'
                  : 'Encrypted scenario unavailable'}
          </AppText>
          {storageError ? <AppText variant="tiny" color="danger">{storageError}</AppText> : null}
          {storageStatus === 'error' ? (
            <Button title="Retry encrypted storage" variant="secondary" onPress={() => void retryLoad()} />
          ) : null}
        </Card>
      ) : null}
      <SegmentedControl options={SECTION_OPTIONS} value={section} onChange={setSection} />
      {wide ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
          <View style={{ flex: 0.9, gap: 12 }}>{basicFields}{advancedFields}</View>
          <View style={{ flex: 1.25 }}>{chartCard}</View>
        </View>
      ) : (
        <View style={{ gap: 12 }}>{basicFields}{advancedFields}{chartCard}</View>
      )}
      {result.ready ? (
        <Card style={{ gap: 10 }}>
          <AppText variant="h3">Assumptions and limits</AppText>
          {result.warnings.map((item) => (
            <Row key={item} style={{ alignItems: 'flex-start' }}>
              <Ionicons name="warning-outline" size={17} color={theme.colors.warning} />
              <AppText variant="small" style={{ flex: 1 }}>{item}</AppText>
            </Row>
          ))}
          {result.assumptions.map((item) => (
            <Row key={item} style={{ alignItems: 'flex-start' }}>
              <Ionicons name="information-circle-outline" size={17} color={theme.colors.textFaint} />
              <AppText variant="small" color="textMuted" style={{ flex: 1 }}>{item}</AppText>
            </Row>
          ))}
          <AppText variant="tiny" color="textFaint">
            Illustrative only. Excludes tax, fees, redraw restrictions, offset eligibility, changing product conditions and personal advice. Confirm repayment rules, interest calculation and maturity instructions with the provider.
          </AppText>
        </Card>
      ) : null}
      <Card style={{ gap: 10 }}>
        <AppText variant="h3">Take the next evidence-backed step</AppText>
        <AppText variant="small" color="textMuted">
          Use this range to browse profile-matched products, then open an exact rate receipt before contacting a provider.
        </AppText>
        <Button
          title="Browse matching products"
          icon="search-outline"
          onPress={() => { void flush().then((saved) => { if (saved) openBrowse(section); }); }}
          disabled={storageStatus !== 'ready'}
        />
      </Card>
    </ScreenScrollView>
  );
}
