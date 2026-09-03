import Ionicons from '../src/components/icons/AppIcon';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, TextInput, useWindowDimensions, View } from 'react-native';

import {
  LifecycleChart,
  type LifecycleChartController,
} from '../src/components/projections/LifecycleChart';
import { ProjectionSummary } from '../src/components/scenario/ProjectionSummary';
import { StaySwitchChart } from '../src/components/scenario/StaySwitchChart';
import { ScreenScrollView } from '../src/components/Screen';
import { CompactToggle, SegmentedControl } from '../src/components/controls';
import { AppText, Badge, Button, Card, Chip, Row } from '../src/components/ui';
import { computeLvr, type CalcInputs } from '../src/data/calc';
import type { ProjectionFrequency, ProjectionInputs } from '../src/data/projectionScenario';
import {
  buildLifecycleProjection,
  MAX_DEPOSIT_BALANCE,
  MAX_MORTGAGE_BALANCE,
  MAX_PERIODIC_AMOUNT,
  MAX_PROJECTION_YEARS,
  projectionMetricLabel,
  type ProjectionDimension,
  type ProjectionMetric,
} from '../src/data/projections';
import { useUserRateScenario } from '../src/hooks/useUserRateScenario';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useStore } from '../src/data/store';
import type { SectionKey } from '../src/types';
import { useTheme } from '../src/theme/ThemeProvider';
import { openBrowse } from '../src/lib/nav';
import { buildStaySwitchProjection } from '../src/data/staySwitchProjection';
import { findByKey } from '../src/data/selectors';
import { NOT_LISTED_PROVIDER } from '../src/data/userRateScenario';
import { auditActionString } from '../src/lib/performanceAuditActionParams';
import { OpaquePerformanceAuditRenderRevision } from '../src/lib/performanceAuditReadiness';

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

function positiveAmountError(
  value: string,
  label: string,
  maximum: number,
  maximumLabel: string,
  required = false,
): string | undefined {
  const parsed = enteredNumber(value);
  if (parsed == null) return required || value.trim() ? `Enter ${label}.` : undefined;
  if (parsed <= 0) return `Enter ${label}.`;
  if (parsed > maximum) return `Use ${label} no greater than ${maximumLabel}.`;
  return undefined;
}

function optionalAmountError(value: string, maximum: number, maximumLabel: string): string | undefined {
  if (!value.trim()) return undefined;
  const parsed = enteredNumber(value);
  if (parsed == null || parsed < 0 || parsed > maximum) {
    return `Use an amount from $0 to ${maximumLabel}.`;
  }
  return undefined;
}

function utcTodayMs(now = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

function validPastIsoDate(value: string, now = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime())
    && parsed.toISOString().slice(0, 10) === value
    && parsed.getTime() < utcTodayMs(now);
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

export default function Projections() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ section?: string; target?: string; ri?: string }>();
  const core = useStore((s) => s.core);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? '');
  const storeStatus = useStore((s) => s.status);
  const storeError = useStore((s) => s.error);
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const ensureDetails = useStore((s) => s.ensureDetails);
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
  const [layoutReady, setLayoutReady] = useState(false);
  const [chartEvidence, setChartEvidence] = useState<{
    revision: string;
    selectionIndex: number;
    accessibleSummary: boolean;
  } | null>(null);
  const chartControllerRef = useRef<LifecycleChartController | null>(null);
  const auditRenderRevisionTracker = useRef<OpaquePerformanceAuditRenderRevision | null>(null);
  auditRenderRevisionTracker.current ??= new OpaquePerformanceAuditRenderRevision();

  const changeSection = useCallback((next: SectionKey) => setSection(next), []);
  const toggleAdvanced = useCallback(() => setAdvanced((value) => !value), []);
  const changeDimension = useCallback((next: ProjectionDimension) => setDimension(next), []);
  const changeMetric = useCallback((next: ProjectionMetric) => setMetric(next), []);

  useEffect(() => changeSection(requestedSection(params.section)), [changeSection, params.section]);

  const projectionKey = section === 'Mortgage' ? 'mortgage' : section === 'TD' ? 'termDeposit' : 'savings';
  const projectionInputs = scenario.projections[projectionKey];
  const updateProjection = useCallback((patch: Partial<ProjectionInputs>) => updateScenario((current) => ({
    ...current,
    projections: {
      ...current.projections,
      [projectionKey]: { ...current.projections[projectionKey], ...patch },
    },
  })), [projectionKey, updateScenario]);
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
  const targetRow = useMemo(() => {
    if (!core || section !== 'Mortgage' || !params.target) return null;
    const found = findByKey(core.sections, params.target);
    if (!found || found.section !== 'Mortgage') return null;
    const parsedIndex = params.ri != null && params.ri !== '' ? Number(params.ri) : null;
    return Number.isInteger(parsedIndex)
      ? found.siblings.find((row) => row.rate_index === parsedIndex) ?? null
      : found.row;
  }, [core, params.ri, params.target, section]);
  useEffect(() => {
    if (!targetRow || detailsProducts) return;
    void ensureDetails({ forProductView: true });
  }, [detailsProducts, ensureDetails, targetRow]);
  const staySwitch = useMemo(() => {
    if (!targetRow) return null;
    const currentRef = deferredScenario.currentProducts.mortgage;
    return buildStaySwitchProjection({
      scenario: deferredScenario,
      target: targetRow,
      currentDetail: currentRef.productKey ? detailsProducts?.[currentRef.productKey] : null,
      targetDetail: detailsProducts?.[targetRow.product_key],
    });
  }, [deferredScenario, detailsProducts, targetRow]);
  const currentBankLabel = scenario.currentProducts.mortgage.provider
    && scenario.currentProducts.mortgage.provider !== NOT_LISTED_PROVIDER
    ? scenario.currentProducts.mortgage.provider
    : 'Current bank';
  useEffect(() => {
    setMetric(result.defaultMetric);
    if (section !== 'Mortgage') setDimension('rates');
  }, [result.defaultMetric, section]);

  const currentMortgageBalance = scenario.mortgage.mode === 'refi'
    ? scenario.mortgage.loanBalance
    : String(Math.round(computeLvr(scenario.mortgage).loan ?? 0) || '');
  const activeSeries = dimension === 'offsets' ? result.offsetSeries : result.rateSeries;
  const inputsEditable = storageStatus === 'ready';
  // Conditional savings has two intentionally separate rates: the conditional
  // rate field is validated below as currentRate, while future range scenarios
  // are centred on the ongoing rate shown in its own validated field.
  const rangeBaseRateText = section === 'Mortgage'
    ? scenario.mortgage.currentRate
    : section === 'TD'
      ? scenario.termDeposit.currentRate
      : projectionInputs.savingsRateStructure === 'conditional-bonus'
        ? projectionInputs.ongoingRate
        : scenario.savings.currentRate;
  const rangeBaseRateNumber = enteredNumber(rangeBaseRateText);
  const historyValues = [projectionInputs.startDate, projectionInputs.startBalance, projectionInputs.startRate];
  const hasHistoryInput = historyValues.some((value) => value.trim().length > 0);
  const startDateValid = validPastIsoDate(projectionInputs.startDate);
  const errors: Record<string, string | undefined> = {
    mortgageBalance: section === 'Mortgage'
      ? positiveAmountError(currentMortgageBalance, 'the current loan balance', MAX_MORTGAGE_BALANCE, '$100 million')
      : undefined,
    savingsBalance: section === 'Savings'
      ? positiveAmountError(scenario.savings.balance, 'the current balance', MAX_DEPOSIT_BALANCE, '$20 million')
      : undefined,
    tdBalance: section === 'TD'
      ? positiveAmountError(scenario.termDeposit.balance, 'the deposit amount', MAX_DEPOSIT_BALANCE, '$20 million')
      : undefined,
    currentRate: rateError(
      section === 'Mortgage' ? scenario.mortgage.currentRate : section === 'TD' ? scenario.termDeposit.currentRate : scenario.savings.currentRate,
      false,
    ),
    years: section === 'Mortgage' && scenario.mortgage.years.trim()
      && (!(enteredNumber(scenario.mortgage.years)! > 0) || enteredNumber(scenario.mortgage.years)! > MAX_PROJECTION_YEARS)
      ? `Use a remaining term above 0 and up to ${MAX_PROJECTION_YEARS} years.`
      : undefined,
    fixedPeriod: projectionInputs.mortgageRateStructure === 'fixed'
      && (!(enteredNumber(projectionInputs.fixedPeriodMonths)! > 0)
        || enteredNumber(projectionInputs.fixedPeriodMonths)! > (enteredNumber(scenario.mortgage.years) ?? 0) * 12)
      ? 'Use a fixed period above 0 and no longer than the remaining loan term.'
      : undefined,
    horizon: section === 'Savings' && projectionInputs.horizonYears.trim()
      && (!(enteredNumber(projectionInputs.horizonYears)! > 0) || enteredNumber(projectionInputs.horizonYears)! > MAX_PROJECTION_YEARS)
      ? `Use a horizon above 0 and up to ${MAX_PROJECTION_YEARS} years.`
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
    startBalance: hasHistoryInput
      ? positiveAmountError(
        projectionInputs.startBalance,
        'a starting balance',
        section === 'Mortgage' ? MAX_MORTGAGE_BALANCE : MAX_DEPOSIT_BALANCE,
        section === 'Mortgage' ? '$100 million' : '$20 million',
        true,
      )
      : undefined,
    startRate: hasHistoryInput ? rateError(projectionInputs.startRate, true) : undefined,
    lowerRate: projectionInputs.lowerRate.trim()
      && (rateError(projectionInputs.lowerRate, false) || enteredNumber(projectionInputs.lowerRate)! > (rangeBaseRateNumber ?? -1))
      ? 'Use a rate from 0% up to the current or ongoing rate.'
      : undefined,
    higherRate: projectionInputs.higherRate.trim()
      && (rateError(projectionInputs.higherRate, false) || enteredNumber(projectionInputs.higherRate)! < (rangeBaseRateNumber ?? 101))
      ? 'Use a rate from the current or ongoing rate up to 100%.'
      : undefined,
    periodicAmount: optionalAmountError(projectionInputs.periodicAmount, MAX_PERIODIC_AMOUNT, '$1 million per selected period'),
    withdrawalAmount: optionalAmountError(projectionInputs.withdrawalAmount, MAX_PERIODIC_AMOUNT, '$1 million per selected period'),
    offsetBalance: optionalAmountError(
      projectionInputs.offsetBalance,
      Math.min(enteredNumber(currentMortgageBalance) ?? MAX_MORTGAGE_BALANCE, MAX_MORTGAGE_BALANCE),
      'the current loan balance',
    ),
    startOffsetBalance: optionalAmountError(projectionInputs.startOffsetBalance, MAX_MORTGAGE_BALANCE, '$100 million'),
    offsetContributionAmount: optionalAmountError(projectionInputs.offsetContributionAmount, MAX_PERIODIC_AMOUNT, '$1 million per selected period'),
    offsetBoostAmount: optionalAmountError(projectionInputs.offsetBoostAmount, MAX_PERIODIC_AMOUNT, '$1 million per selected period'),
    extraRepaymentAmount: optionalAmountError(projectionInputs.extraRepaymentAmount, MAX_PERIODIC_AMOUNT, '$1 million per selected period'),
  };
  const coreRevision = core ? `${core.run_date}:${coreSha}` : null;
  const activeBaseScenario = section === 'Mortgage'
    ? scenario.mortgage
    : section === 'TD'
      ? scenario.termDeposit
      : scenario.savings;
  const projectionStateRevision = auditRenderRevisionTracker.current.update([
    advanced,
    section,
    activeBaseScenario,
    projectionInputs,
  ]);
  const projectionRenderRevision = [
    coreRevision ?? 'none',
    section,
    storageStatus,
    result.asAt,
    result.ready ? 'ready' : `missing:${result.missing.join(',')}`,
    dimension,
    metric,
    chartEvidence?.selectionIndex ?? 'unmeasured',
    projectionStateRevision,
    result.history.length,
    activeSeries.reduce((sum, item) => sum + item.points.length, 0),
  ].join(':');
  const recordChartEvidence = useCallback(({ renderRevision, selectionIndex, accessibleSummary }: {
    renderRevision: string;
    selectionIndex: number;
    accessibleSummary: boolean;
  }) => {
    setChartEvidence((current) => {
      if (
        current?.revision === renderRevision &&
        current.selectionIndex === selectionIndex &&
        current.accessibleSummary === accessibleSummary
      ) {
        return current;
      }
      return { revision: renderRevision, selectionIndex, accessibleSummary };
    });
  }, []);
  const auditSelectSection = useCallback((...args: unknown[]) => {
    const requested = auditActionString(args, 'section');
    if (typeof requested === 'string' && SECTION_OPTIONS.some((item) => item.value === requested)) {
      changeSection(requested as SectionKey);
      return;
    }
    const currentIndex = SECTION_OPTIONS.findIndex((item) => item.value === section);
    changeSection(SECTION_OPTIONS[(currentIndex + 1) % SECTION_OPTIONS.length].value);
  }, [changeSection, section]);
  const selectNextDimension = useCallback(() => {
    changeDimension(dimension === 'rates' ? 'offsets' : 'rates');
  }, [changeDimension, dimension]);
  const selectNextMetric = useCallback(() => {
    const currentIndex = result.availableMetrics.indexOf(metric);
    const next = result.availableMetrics[(currentIndex + 1) % Math.max(1, result.availableMetrics.length)];
    if (next) changeMetric(next);
  }, [changeMetric, metric, result.availableMetrics]);
  const chartPrevious = useCallback(() => chartControllerRef.current?.previous(), []);
  const chartNext = useCallback(() => chartControllerRef.current?.next(), []);
  const auditApplyInputs = useCallback((...args: unknown[]) => {
    if (storageStatus !== 'ready') {
      return { unavailableReason: 'Encrypted projection scenario is not ready' };
    }
    const currentRate = auditActionString(args, 'currentRate');
    const years = auditActionString(args, 'years');
    const loanBalance = auditActionString(args, 'loanBalance');
    const propertyValue = auditActionString(args, 'propertyValue');
    const balance = auditActionString(args, 'balance');
    const horizonYears = auditActionString(args, 'horizonYears');
    const lowerRate = auditActionString(args, 'lowerRate');
    const higherRate = auditActionString(args, 'higherRate');
    const offsetBalance = auditActionString(args, 'offsetBalance');
    const extraRepaymentAmount = auditActionString(args, 'extraRepaymentAmount');
    const mortgageRateStructure = auditActionString(args, 'mortgageRateStructure');
    const fixedPeriodMonths = auditActionString(args, 'fixedPeriodMonths');
    const termMonths = auditActionString(args, 'termMonths');
    const modeRaw = auditActionString(args, 'mode');
    if (section === 'Mortgage') {
      const hasMortgageParams = Boolean(
        modeRaw
        || propertyValue
        || loanBalance
        || currentRate
        || years
        || lowerRate
        || higherRate
        || offsetBalance
        || extraRepaymentAmount
        || mortgageRateStructure
        || fixedPeriodMonths,
      );
      if (!hasMortgageParams) {
        return {
          unavailableReason: 'Mortgage projection apply requires mortgage and/or projection input parameters',
        };
      }
      updateScenario((current) => ({
        ...current,
        mortgage: {
          ...current.mortgage,
          ...(modeRaw === 'buy' || modeRaw === 'refi' ? { mode: modeRaw } : {}),
          ...(propertyValue ? { propertyValue } : {}),
          ...(loanBalance ? { loanBalance } : {}),
          ...(currentRate ? { currentRate } : {}),
          ...(years ? { years } : {}),
        },
        projections: {
          ...current.projections,
          mortgage: {
            ...current.projections.mortgage,
            ...(lowerRate ? { lowerRate } : {}),
            ...(higherRate ? { higherRate } : {}),
            ...(offsetBalance ? { offsetBalance } : {}),
            ...(extraRepaymentAmount ? { extraRepaymentAmount } : {}),
            ...(mortgageRateStructure === 'fixed' || mortgageRateStructure === 'variable'
              ? { mortgageRateStructure }
              : {}),
            ...(fixedPeriodMonths ? { fixedPeriodMonths } : {}),
          },
        },
      }));
      return { applied: 'mortgage', currentRate: currentRate ?? null, years: years ?? null };
    }
    if (!balance && !currentRate && !horizonYears && !lowerRate && !higherRate && !termMonths) {
      return {
        unavailableReason: 'Deposit projection apply requires balance, rate, horizon, and/or term parameters',
      };
    }
    updateScenario((current) => {
      const key = section === 'TD' ? 'termDeposit' : 'savings';
      return {
        ...current,
        [key]: {
          ...current[key],
          ...(balance ? { balance } : {}),
          ...(currentRate ? { currentRate } : {}),
        },
        projections: {
          ...current.projections,
          [key]: {
            ...current.projections[key],
            ...(horizonYears ? { horizonYears } : {}),
            ...(lowerRate ? { lowerRate } : {}),
            ...(higherRate ? { higherRate } : {}),
            ...(termMonths ? { termMonths } : {}),
          },
        },
      };
    });
    return { applied: section === 'TD' ? 'termDeposit' : 'savings', balance: balance ?? null, currentRate: currentRate ?? null };
  }, [section, storageStatus, updateScenario]);
  const auditRateStructureNext = useCallback(() => {
    if (storageStatus !== 'ready') {
      return { unavailableReason: 'Encrypted projection scenario is not ready' };
    }
    if (section !== 'Mortgage') {
      return { unavailableReason: 'Mortgage rate-structure selection only applies on Mortgage projections' };
    }
    const next = projectionInputs.mortgageRateStructure === 'fixed' ? 'variable' : 'fixed';
    updateProjection({
      mortgageRateStructure: next,
      ...(next === 'fixed' && !projectionInputs.fixedPeriodMonths.trim()
        ? { fixedPeriodMonths: '24' }
        : {}),
    });
    return { mortgageRateStructure: next };
  }, [projectionInputs.fixedPeriodMonths, projectionInputs.mortgageRateStructure, section, storageStatus, updateProjection]);
  const auditActions = useMemo(() => ({
    'projections.open': () => undefined,
    'projections.inputs.apply-primary': auditApplyInputs,
    'projections.inputs.apply-alternate': auditApplyInputs,
    'projections.rate-structure.next': auditRateStructureNext,
    'projections.advanced.toggle': toggleAdvanced,
    'projections.metric.next': result.ready
      ? selectNextMetric
      : () => ({ unavailableReason: `Incomplete existing scenario: ${result.missing.join(', ')}` }),
    'projections.chart.previous': result.ready
      ? chartPrevious
      : () => ({ unavailableReason: `Incomplete existing scenario: ${result.missing.join(', ')}` }),
    'projections.chart.next': result.ready
      ? chartNext
      : () => ({ unavailableReason: `Incomplete existing scenario: ${result.missing.join(', ')}` }),
    'projections.section.next': result.ready
      ? auditSelectSection
      : () => ({ unavailableReason: `Incomplete existing scenario: ${result.missing.join(', ')}` }),
    'projections.dimension.next': result.ready && section === 'Mortgage'
      ? selectNextDimension
      : () => ({
          unavailableReason: result.ready
            ? 'The rates-versus-offset dimension control only renders for mortgages'
            : `Incomplete existing scenario: ${result.missing.join(', ')}`,
        }),
  }), [
    auditApplyInputs,
    auditRateStructureNext,
    auditSelectSection,
    chartNext,
    chartPrevious,
    result.missing,
    result.ready,
    section,
    selectNextDimension,
    selectNextMetric,
    toggleAdvanced,
  ]);
  usePerformanceAuditSurface({
    id: 'projections.lifecycle-chart',
    routeKey: '/projections',
    datasetRevision: coreRevision,
    renderRevision: projectionRenderRevision,
    actions: auditActions,
    probes: [
      {
        id: 'projections.data',
        kind: 'data',
        status: core ? 'ready' : storeStatus === 'error' ? 'error' : 'pending',
        error: !core && storeStatus === 'error' ? storeError ?? 'Core data unavailable' : null,
        datasetRevision: coreRevision,
      },
      {
        id: 'projections.scenario-storage',
        kind: 'data',
        status: storageStatus === 'ready' ? 'ready' : storageStatus === 'error' ? 'error' : 'pending',
        error: storageStatus === 'error' ? storageError ?? 'Encrypted scenario unavailable' : null,
      },
      {
        id: 'projections.model',
        kind: 'data',
        required: false,
        status: result.ready ? 'ready' : 'error',
        error: result.ready ? null : `Incomplete scenario: ${result.missing.join(', ')}`,
      },
      {
        id: 'projections.chart',
        kind: 'graphic',
        required: result.ready,
        status: !result.ready || chartEvidence?.revision === projectionRenderRevision ? 'ready' : 'pending',
        expectedCount: result.ready ? 1 : 0,
        actualCount: result.ready && chartEvidence?.revision === projectionRenderRevision ? 1 : 0,
        accessibleSummary: chartEvidence?.revision === projectionRenderRevision
          ? chartEvidence.accessibleSummary
          : false,
        renderRevision: projectionRenderRevision,
      },
      {
        id: 'projections.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
        renderRevision: projectionRenderRevision,
      },
    ],
  });
  usePerformanceAuditSurface({
    id: 'projections.inputs',
    routeKey: '/projections',
    datasetRevision: coreRevision,
    renderRevision: projectionRenderRevision,
    actions: auditActions,
    probes: [
      {
        id: 'projections-inputs.data',
        kind: 'data',
        status: core ? 'ready' : storeStatus === 'error' ? 'error' : 'pending',
        error: !core && storeStatus === 'error' ? storeError ?? 'Core data unavailable' : null,
        datasetRevision: coreRevision,
      },
      {
        id: 'projections-inputs.scenario-storage',
        kind: 'data',
        status: storageStatus === 'ready' ? 'ready' : storageStatus === 'error' ? 'error' : 'pending',
        error: storageStatus === 'error' ? storageError ?? 'Encrypted scenario unavailable' : null,
      },
      {
        id: 'projections-inputs.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
        renderRevision: projectionRenderRevision,
      },
    ],
  });

  const basicFields = (
    <Card style={{ gap: 14 }}>
      <View>
        <AppText variant="h3">Start with today</AppText>
        <AppText variant="small" color="textMuted" style={{ marginTop: 3 }}>
          These values are shared with Today and My scenario. Editing them updates only your private local scenario.
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
        onPress={toggleAdvanced}
        accessibilityRole="button"
        accessibilityLabel={advanced ? 'Hide optional projection assumptions' : 'Show optional projection assumptions'}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="700">More assumptions</AppText>
          <AppText variant="tiny" color="textMuted">History, contributions and alternative rates</AppText>
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
            <AppText variant="h3">Your rate scenario</AppText>
            <AppText variant="small" color="textMuted" style={{ marginTop: 3 }}>
              From {result.history.length > 1 ? 'your optional starting point' : 'today'} through the modelled end date
            </AppText>
          </View>
          <Badge label="Illustrative" tone="primary" />
        </Row>
      </View>
      {!result.ready ? (
        <View style={{ gap: 12 }}>
          <AppText variant="body" color="textMuted">
            Fix or add {result.missing.join(', ')} above to build this projection.
          </AppText>
          <Button
            title="Edit My scenario"
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
              onChange={changeDimension}
            />
          ) : null}
          <View>
            <AppText variant="tiny" color="textFaint" weight="700" style={{ marginBottom: 8 }}>Y-AXIS</AppText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
              {result.availableMetrics.map((item) => (
                <Chip key={item} label={projectionMetricLabel(section, item)} selected={metric === item} onPress={() => changeMetric(item)} />
              ))}
            </View>
          </View>
          <LifecycleChart
            section={section}
            history={result.history}
            series={activeSeries}
            metric={metric}
            asAt={result.asAt}
            renderRevision={projectionRenderRevision}
            controllerRef={chartControllerRef}
            onRenderReady={recordChartEvidence}
          />
          <ProjectionSummary section={section} result={result} />
        </>
      )}
    </Card>
  );

  return (
    <ScreenScrollView
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => setLayoutReady(true)}
    >
      <Card style={{ gap: 8, borderColor: `${theme.colors.primary}55` }}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 220 }}>
            <AppText variant="h2">What if rates change?</AppText>
            <AppText variant="body" color="textMuted" style={{ marginTop: 5 }}>
              Test repayments, interest and balances under different rates.
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
                  : storageStatus === 'error'
                    ? 'Encrypted scenario unavailable'
                    : 'Encrypted scenario reset'}
          </AppText>
          {storageError ? <AppText variant="tiny" color="danger">{storageError}</AppText> : null}
          {storageStatus === 'error' ? (
            <Button title="Retry encrypted storage" variant="secondary" onPress={() => void retryLoad()} />
          ) : null}
        </Card>
      ) : null}
      <SegmentedControl options={SECTION_OPTIONS} value={section} onChange={changeSection} />
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
            Illustrative. Check fees, product conditions and lender calculations before acting.
          </AppText>
        </Card>
      ) : null}
      {staySwitch?.ready ? (
        <StaySwitchChart projection={staySwitch} currentBank={currentBankLabel} />
      ) : null}
      <Card style={{ gap: 10 }}>
        <AppText variant="h3">Compare this scenario</AppText>
        <AppText variant="small" color="textMuted">
          Browse matching rates, then prepare a bank-call brief for an exact tier.
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
