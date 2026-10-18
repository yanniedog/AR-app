import { LocalRateEditor } from '../scenario/LocalRateEditor';
import { PublicRateEvidence } from '../scenario/PublicRateEvidence';
import { PublicCostComparison } from '../scenario/PublicCostComparison';
import { SavingsQualificationEditor } from '../scenario/SavingsQualificationEditor';
import { usePublicRateCatalogue } from '../../data/publicRateCatalogue';
import { publicComparisonCore, publicRateScenario, resolveLocalCurrentRate, resolveRowPublicRate, scenarioWithLocalCurrentRate } from '../../data/publicRateIntegration';
import { uiDate, uiDuration, uiInputNumber, uiJoin, uiLabel, uiMoney, uiSectionName, type UiCopy, type UiText } from "../../lib/uiCopy";
import { fontStyle } from '../../theme/fonts';
import { prepareProjectionAuditScenario } from '../../lib/performanceAuditScenario';
import { mandatoryProductAllowed } from '../../data/eligibilityGate';
import Ionicons from '../../components/icons/AppIcon';
import { router, useLocalSearchParams } from 'expo-router';
import { useSuitabilityRevision } from '../../hooks/useSuitabilityRevision';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, TextInput, useWindowDimensions, View } from 'react-native';

import {
  LifecycleChart,
  type LifecycleChartController,
  type LifecycleChartRenderEvidence,
} from '../../components/projections/LifecycleChart';
import { ProjectionSummary } from '../../components/scenario/ProjectionSummary';
import { StaySwitchChart } from '../../components/scenario/StaySwitchChart';
import { ScreenScrollView } from '../../components/Screen';
import { CompactToggle, SegmentedControl } from '../../components/controls';
import { AppText, Badge, Button, Card, Chip, Row } from '../../components/ui';
import { computeLvr, type CalcInputs } from '../../data/calc';
import type { ProjectionFrequency, ProjectionInputs } from '../../data/projectionScenario';
import {
  buildLifecycleProjection,
  MAX_DEPOSIT_BALANCE,
  MAX_MORTGAGE_BALANCE,
  MAX_PERIODIC_AMOUNT,
  MAX_PROJECTION_YEARS,
  metricValue,
  projectionMetricLabel,
  type ProjectionDimension,
  type ProjectionMetric,
} from '../../data/projections';
import { useUserRateScenario } from '../../hooks/useUserRateScenario';
import { useScenarioSection } from '../../hooks/useScenarioSection';
import { usePerformanceAuditSurface } from '../../hooks/usePerformanceAuditReadiness';
import { useStore } from '../../data/store';
import type { SectionKey } from '../../types';
import { useTheme } from '../../theme/ThemeProvider';
import { openBrowse } from '../../lib/nav';
import { buildStaySwitchProjection } from '../../data/staySwitchProjection';
import { resolveCalculationTarget } from '../../lib/calculationTarget';
import { selectedTargetConstraint, targetConstraintContradicted } from '../../lib/selectedTargetConstraints';
import { SelectedCalculationTarget } from './SelectedCalculationTarget';
import { ProjectionFactRows } from './ProjectionFactRows';
import { NOT_LISTED_PROVIDER } from '../../data/userRateScenario';
import { auditActionString } from '../../lib/performanceAuditActionParams';
import { OpaquePerformanceAuditRenderRevision } from '../../lib/performanceAuditReadiness';
import { SECTION_ORDER } from '../../constants';

const SECTION_OPTIONS = SECTION_ORDER.map(value => ({ value, label: uiSectionName(value) }));

const FREQUENCY_OPTIONS: { label: UiCopy; value: ProjectionFrequency }[] = [
  { label: uiLabel("Weekly"), value: 'weekly' },
  { label: uiLabel("Fortnightly"), value: 'fortnightly' },
  { label: uiLabel("Monthly"), value: 'monthly' },
];

function enteredNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[$,%\s,]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function rateError(value: string, required: boolean): UiText | undefined {
  const parsed = enteredNumber(value);
  if (parsed == null) return required || value.trim() ? uiJoin('Rate',': ',0,'–',100,'%') : undefined;
  return parsed < 0 || parsed > 100 ? uiJoin('Rate',': ',0,'–',100,'%') : undefined;
}

function positiveAmountError(
  value: string,
  label: UiCopy,
  maximum: number,
  required = false,
): UiText | undefined {
  const parsed = enteredNumber(value);
  if (parsed == null) return required || value.trim() ? uiJoin(label,': ','Required') : undefined;
  if (parsed <= 0) return uiJoin(label,': ','Required');
  if (parsed > maximum) return uiJoin(label,': ','≤',uiMoney(maximum));
  return undefined;
}

function optionalAmountError(value: string, maximum: number): UiText | undefined {
  if (!value.trim()) return undefined;
  const parsed = enteredNumber(value);
  if (parsed == null || parsed < 0 || parsed > maximum) {
    return uiJoin('Amount',': ',uiMoney(0),'–',uiMoney(maximum));
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
  label: UiCopy;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: 'YYYY-MM-DD' | 'Automatic';
  prefix?: UiCopy;
  suffix?: UiCopy;
  date?: boolean;
  editable?: boolean;
  error?: UiCopy;
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
          value={uiInputNumber(value)}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textFaint}
          keyboardType={date ? 'numbers-and-punctuation' : 'decimal-pad'}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}

          accessibilityState={{ disabled: !editable }}
          editable={editable}
          maxLength={20}
          style={{
            ...fontStyle('400'),
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
  label: UiCopy;
  value: ProjectionFrequency;
  amount: string;
  onAmount: (value: string) => void;
  onFrequency: (value: ProjectionFrequency) => void;
  editable?: boolean;
  error?: UiCopy;
}) {
  return (
    <View style={{ gap: 8 }}>
      <NumericField label={label} value={amount} onChangeText={onAmount} prefix="$" editable={editable} error={error} />
      <SegmentedControl options={FREQUENCY_OPTIONS} value={value} onChange={(next) => { if (editable) onFrequency(next); }} />
    </View>
  );
}

export function ProjectionWorkspace() {
  const suitabilityRevision = useSuitabilityRevision();
  const theme = useTheme();
  const params = useLocalSearchParams<{ section?: string; target?: string | string[]; ri?: string | string[]; programme?: string | string[] }>();
  const core = useStore((s) => s.core);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? '');
  const manifest = useStore((s) => s.manifest);
  const coreIntegrity = useStore((s) => s.coreIntegrity);
  const profile = useStore(state => state.prefs.profileFilters);
  const catalogue = usePublicRateCatalogue(manifest);
  const details = useStore((s) => s.details);
  const storeStatus = useStore((s) => s.status);
  const storeError = useStore((s) => s.error);
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const activeSection = useStore((s) => s.activeSection);
  const { width, fontScale } = useWindowDimensions();
  const wide = width >= 860 && fontScale < 1.5;
  const [section] = useScenarioSection(activeSection);
  const changeSection = useCallback((next: SectionKey) => router.setParams({ section: next, target: undefined, ri: undefined }), []);
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
    expectedCount: number;
    pointCount: number;
    layoutMeasured: boolean;
    emptyStateRendered: boolean;
  } | null>(null);
  const chartControllerRef = useRef<LifecycleChartController | null>(null);
  const auditRenderRevisionTracker = useRef<OpaquePerformanceAuditRenderRevision | null>(null);
  auditRenderRevisionTracker.current ??= new OpaquePerformanceAuditRenderRevision();

  const toggleAdvanced = useCallback(() => setAdvanced((value) => !value), []);
  const changeDimension = useCallback((next: ProjectionDimension) => setDimension(next), []);
  const changeMetric = useCallback((next: ProjectionMetric) => setMetric(next), []);

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
  const { status: catalogueStatus, allLoaded, loadAll } = catalogue;
  useEffect(() => { if (catalogueStatus === 'ready' && !allLoaded) void loadAll().catch(() => undefined); }, [catalogueStatus, allLoaded, loadAll]);
  const localCurrent = useMemo(() => resolveLocalCurrentRate(section, scenario, catalogue.references, undefined, catalogue, profile), [section, scenario, catalogue, profile]);
  const calculationScenario = useMemo(() => scenarioWithLocalCurrentRate(section, scenario, localCurrent), [section, scenario, localCurrent]);
  const deferredScenario = useDeferredValue(calculationScenario);
  const result = useMemo(
    () => buildLifecycleProjection(section, deferredScenario),
    [deferredScenario, section],
  );
  const target = useMemo(() => {
    void suitabilityRevision;
    return resolveCalculationTarget(core ? publicComparisonCore(core, catalogue, s => publicRateScenario(s, deferredScenario, profile)) : null, section, { target: params.target, ri: params.ri, programme: params.programme });
  }, [core, params.ri, params.target, params.programme, section, suitabilityRevision, catalogue, deferredScenario, profile]);
  const targetRow = target.status === 'available' && target.section === 'Mortgage' ? target.row : null;
  const rateConditionContext = useMemo(() => ({ core, details, manifest, coreIntegrity }), [core, details, manifest, coreIntegrity]);
  const targetConstraint = useMemo(() => target.status === 'available'
    ? selectedTargetConstraint(target.row, section, scenario, rateConditionContext) : undefined,
  [target, section, scenario, rateConditionContext]);
  const targetContradicted = targetConstraintContradicted(targetConstraint);
  useEffect(() => {
    if (!params.target || detailsProducts) return;
    void ensureDetails({ forProductView: true });
  }, [detailsProducts, ensureDetails, params.target]);
  const staySwitch = useMemo(() => {
    if (!targetRow || targetContradicted
      || targetConstraintContradicted(selectedTargetConstraint(targetRow, 'Mortgage', deferredScenario, rateConditionContext))) return null;
    const currentRef = deferredScenario.currentProducts.mortgage;
    return buildStaySwitchProjection({
      scenario: deferredScenario,
      target: (() => {
        const resolution = resolveRowPublicRate(targetRow, catalogue, publicRateScenario(section, deferredScenario, profile, targetRow));
        return resolution ? { ...targetRow, rate: resolution.status === 'exact' && resolution.verifiedCurrent ? resolution.payableRate ?? '' : '' } : targetRow;
      })(),
      currentDetail: currentRef.productKey && mandatoryProductAllowed(currentRef.productKey) ? detailsProducts?.[currentRef.productKey] : null,
      targetDetail: detailsProducts?.[targetRow.product_key],
    });
  }, [deferredScenario, detailsProducts, targetRow, targetContradicted, rateConditionContext, catalogue, section, profile]);
  const currentBankLabel = (!scenario.currentProducts.mortgage.productKey || mandatoryProductAllowed(scenario.currentProducts.mortgage.productKey)) && scenario.currentProducts.mortgage.provider
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
  const errors: Record<string, UiCopy | undefined> = {
    mortgageBalance: section === 'Mortgage'
      ? positiveAmountError(currentMortgageBalance, 'Loan balance', MAX_MORTGAGE_BALANCE)
      : undefined,
    savingsBalance: section === 'Savings'
      ? positiveAmountError(scenario.savings.balance, 'Balance', MAX_DEPOSIT_BALANCE)
      : undefined,
    tdBalance: section === 'TD'
      ? positiveAmountError(scenario.termDeposit.balance, 'Deposit amount', MAX_DEPOSIT_BALANCE)
      : undefined,
    currentRate: rateError(
      section === 'Mortgage' ? scenario.mortgage.currentRate : section === 'TD' ? scenario.termDeposit.currentRate : scenario.savings.currentRate,
      false,
    ),
    years: section === 'Mortgage' && scenario.mortgage.years.trim()
      && (!(enteredNumber(scenario.mortgage.years)! > 0) || enteredNumber(scenario.mortgage.years)! > MAX_PROJECTION_YEARS)
      ? uiJoin('Remaining term',': ','>',0,'–',uiDuration(MAX_PROJECTION_YEARS,'years'))
      : undefined,
    fixedPeriod: projectionInputs.mortgageRateStructure === 'fixed'
      && (!(enteredNumber(projectionInputs.fixedPeriodMonths)! > 0)
        || enteredNumber(projectionInputs.fixedPeriodMonths)! > (enteredNumber(scenario.mortgage.years) ?? 0) * 12)
      ? uiJoin('Fixed period',': ','>',0,'–','Remaining term')
      : undefined,
    horizon: section === 'Savings' && projectionInputs.horizonYears.trim()
      && (!(enteredNumber(projectionInputs.horizonYears)! > 0) || enteredNumber(projectionInputs.horizonYears)! > MAX_PROJECTION_YEARS)
      ? uiJoin('Projection horizon',': ','>',0,'–',uiDuration(MAX_PROJECTION_YEARS,'years'))
      : undefined,
    ongoingRate: projectionInputs.savingsRateStructure === 'conditional-bonus'
      ? rateError(projectionInputs.ongoingRate, true)
      : undefined,
    bonusMonths: projectionInputs.savingsRateStructure === 'conditional-bonus'
      && (!Number.isInteger(enteredNumber(projectionInputs.bonusMonthsRemaining))
        || enteredNumber(projectionInputs.bonusMonthsRemaining)! < 0
        || enteredNumber(projectionInputs.bonusMonthsRemaining)! > 60)
      ? uiJoin('Bonus period',': ',0,'–',60,' · ','Whole months')
      : undefined,
    termMonths: section === 'TD' && projectionInputs.termMonths.trim()
      && (!Number.isInteger(enteredNumber(projectionInputs.termMonths))
        || enteredNumber(projectionInputs.termMonths)! < 1
        || enteredNumber(projectionInputs.termMonths)! > 120)
      ? uiJoin('Term',': ',1,'–',120,' · ','Whole months')
      : undefined,
    rollovers: section === 'TD'
      && (!Number.isInteger(enteredNumber(projectionInputs.rollovers))
        || enteredNumber(projectionInputs.rollovers)! < 0
        || enteredNumber(projectionInputs.rollovers)! > 10)
      ? uiJoin('Rollovers',': ',0,'–',10,' · ','Whole numbers')
      : undefined,
    startDate: hasHistoryInput && !startDateValid ? uiJoin('Past date',': ','YYYY-MM-DD') : undefined,
    startBalance: hasHistoryInput
      ? positiveAmountError(
        projectionInputs.startBalance,
        'Starting balance',
        section === 'Mortgage' ? MAX_MORTGAGE_BALANCE : MAX_DEPOSIT_BALANCE,
        true,
      )
      : undefined,
    startRate: hasHistoryInput ? rateError(projectionInputs.startRate, true) : undefined,
    lowerRate: projectionInputs.lowerRate.trim()
      && (rateError(projectionInputs.lowerRate, false) || enteredNumber(projectionInputs.lowerRate)! > (rangeBaseRateNumber ?? -1))
      ? uiJoin('Rate',': ',0,'%','–','Current / ongoing')
      : undefined,
    higherRate: projectionInputs.higherRate.trim()
      && (rateError(projectionInputs.higherRate, false) || enteredNumber(projectionInputs.higherRate)! < (rangeBaseRateNumber ?? 101))
      ? uiJoin('Rate',': ','Current / ongoing','–',100,'%')
      : undefined,
    periodicAmount: optionalAmountError(projectionInputs.periodicAmount, MAX_PERIODIC_AMOUNT),
    withdrawalAmount: optionalAmountError(projectionInputs.withdrawalAmount, MAX_PERIODIC_AMOUNT),
    offsetBalance: optionalAmountError(
      projectionInputs.offsetBalance,
      Math.min(enteredNumber(currentMortgageBalance) ?? MAX_MORTGAGE_BALANCE, MAX_MORTGAGE_BALANCE),
    ),
    startOffsetBalance: optionalAmountError(projectionInputs.startOffsetBalance, MAX_MORTGAGE_BALANCE),
    offsetContributionAmount: optionalAmountError(projectionInputs.offsetContributionAmount, MAX_PERIODIC_AMOUNT),
    offsetBoostAmount: optionalAmountError(projectionInputs.offsetBoostAmount, MAX_PERIODIC_AMOUNT),
    extraRepaymentAmount: optionalAmountError(projectionInputs.extraRepaymentAmount, MAX_PERIODIC_AMOUNT),
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
    params.target,
    params.ri,
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
  const recordChartEvidence = useCallback(({ renderRevision, ...evidence }: LifecycleChartRenderEvidence) => {
    setChartEvidence((current) => {
      if (
        current?.revision === renderRevision &&
        current.selectionIndex === evidence.selectionIndex &&
        current.accessibleSummary === evidence.accessibleSummary &&
        current.pointCount === evidence.pointCount &&
        current.expectedCount === evidence.expectedCount &&
        current.layoutMeasured === evidence.layoutMeasured &&
        current.emptyStateRendered === evidence.emptyStateRendered
      ) {
        return current;
      }
      return { revision: renderRevision, ...evidence };
    });
  }, []);
  const auditSelectSection = useCallback((...args: unknown[]) => {
    const requested = auditActionString(args, 'section');
    const requestedSection=SECTION_OPTIONS.find(item=>item.value===requested)?.value;
    if (requestedSection) {
      changeSection(requestedSection);
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
      updateScenario((previous) => {
        const current = prepareProjectionAuditScenario(previous);
        return {
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
        };
      });
      return { applied: 'mortgage' };
    }
    if (!balance && !currentRate && !horizonYears && !lowerRate && !higherRate && !termMonths) {
      return {
        unavailableReason: 'Deposit projection apply requires balance, rate, horizon, and/or term parameters',
      };
    }
    updateScenario((previous) => {
      const current = prepareProjectionAuditScenario(previous);
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
    return { applied: section === 'TD' ? 'termDeposit' : 'savings' };
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
    routeKey: '/calculator',
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
        id: 'projections.target',
        kind: 'data',
        status: target.status === 'pending' ? 'pending' : target.status === 'unavailable' ? 'error' : 'ready',
        error: target.status === 'unavailable' ? 'Selected calculation target is unavailable' : null,
      },
      {
        id: 'projections.scenario-storage',
        kind: 'data',
        status: storageStatus === 'ready' ? 'ready' : storageStatus === 'error' ? 'error' : 'pending',
        error: storageStatus === 'error' ? storageError ?? 'Scenario unavailable' : null,
      },
      {
        id: 'projections.model',
        kind: 'data',
        required: false,
        status: deferredScenario !== scenario ? 'pending' : result.ready ? 'ready' : 'error',
        error: deferredScenario !== scenario || result.ready ? null : `Incomplete scenario: ${result.missing.join(', ')}`,
      },
      {
        id: 'projections.chart',
        kind: 'graphic',
        required: result.ready,
        status: !result.ready || chartEvidence?.revision === projectionRenderRevision ? 'ready' : 'pending',
        expectedCount: result.ready ? [...result.history, ...activeSeries.flatMap((item) => item.points)]
          .filter((point) => metricValue(point, metric) != null).length : 0,
        actualCount: result.ready && chartEvidence?.revision === projectionRenderRevision ? chartEvidence.pointCount : 0,
        layoutMeasured: chartEvidence?.revision === projectionRenderRevision && chartEvidence.layoutMeasured,
        emptyStateRendered: chartEvidence?.revision === projectionRenderRevision && chartEvidence.emptyStateRendered,
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
    routeKey: '/calculator',
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
        error: storageStatus === 'error' ? storageError ?? 'Scenario unavailable' : null,
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
      <AppText variant="h3">{uiLabel("Current values")}</AppText>
      <LocalRateEditor section={section} scenario={scenario} editable={inputsEditable} onChange={patch => updateScenario(previous => ({ ...previous, localRates: { ...previous.localRates, [projectionKey]: { ...previous.localRates[projectionKey], ...patch } } }))}>
        <NumericField label="Current interest rate" value={section === 'Mortgage' ? scenario.mortgage.currentRate : section === 'TD' ? scenario.termDeposit.currentRate : scenario.savings.currentRate}
          onChangeText={currentRate => section === 'Mortgage' ? updateMortgage({ currentRate }) : updateDeposit({ currentRate })} suffix="%" editable={inputsEditable} error={errors.currentRate} />
      </LocalRateEditor>
      {section === 'Mortgage' ? (
        <>
          <Row gap={10} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <NumericField
              label={uiLabel(scenario.mortgage.mode === 'buy' ? 'Calculated loan amount' : 'Current loan balance')}
              value={currentMortgageBalance}
              onChangeText={(loanBalance) => updateMortgage({ loanBalance })}
              prefix="$"
              editable={inputsEditable && scenario.mortgage.mode !== 'buy'}
              error={errors.mortgageBalance}
            />
            <NumericField label="Years remaining" value={scenario.mortgage.years} onChangeText={(years) => updateMortgage({ years })} suffix="years" editable={inputsEditable} error={errors.years} />
            <NumericField label="Comparison period" value={projectionInputs.horizonYears} onChangeText={horizonYears => updateProjection({ horizonYears })} suffix="years" editable={inputsEditable} error={errors.horizon} />
          </Row>
          {scenario.mortgage.mode === 'buy' ? (
            <Button title="Purchase details" variant="secondary" onPress={() => {
              void flush().then(saved => { if (saved) router.setParams({ mode: 'check' }); });
            }} />
          ) : null}
          <SegmentedControl
            options={[
              { label: uiLabel("Variable rate"), value: 'variable' },
              { label: uiLabel("Fixed rate"), value: 'fixed' },
            ]}
            value={projectionInputs.mortgageRateStructure}
            onChange={(mortgageRateStructure) => { if (inputsEditable) updateProjection({ mortgageRateStructure }); }}
          />
          {projectionInputs.mortgageRateStructure === 'fixed' ? (
            <NumericField
              label="Fixed period remaining"
              value={projectionInputs.fixedPeriodMonths}
              onChangeText={(fixedPeriodMonths) => updateProjection({ fixedPeriodMonths })}
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
            <NumericField label="Current offset balance" value={projectionInputs.offsetBalance} onChangeText={(offsetBalance) => updateProjection({ offsetBalance })} prefix="$" editable={inputsEditable} error={errors.offsetBalance} />
            <NumericField label="Amount added to offset" value={projectionInputs.offsetContributionAmount} onChangeText={(offsetContributionAmount) => updateProjection({ offsetContributionAmount })} prefix="$" editable={inputsEditable} error={errors.offsetContributionAmount} />
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
            <NumericField label="Current balance" value={scenario.savings.balance} onChangeText={(balance) => updateDeposit({ balance })} prefix="$" editable={inputsEditable} error={errors.savingsBalance} />
            <NumericField label="Projection horizon" value={projectionInputs.horizonYears} onChangeText={(horizonYears) => updateProjection({ horizonYears })} suffix="years" editable={inputsEditable} error={errors.horizon} />
          </Row>
          <SegmentedControl
            options={[
              { label: uiLabel("Ongoing rate"), value: 'ongoing' },
              { label: uiLabel("Conditional bonus"), value: 'conditional-bonus' },
            ]}
            value={projectionInputs.savingsRateStructure}
            onChange={(savingsRateStructure) => { if (inputsEditable) updateProjection({ savingsRateStructure }); }}
          />
          {projectionInputs.savingsRateStructure === 'conditional-bonus' ? (
            <>
              <Row gap={10} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <NumericField label="Ongoing rate" value={projectionInputs.ongoingRate} onChangeText={(ongoingRate) => updateProjection({ ongoingRate })} suffix="%" editable={inputsEditable} error={errors.ongoingRate} />
                <NumericField label="Bonus period remaining" value={projectionInputs.bonusMonthsRemaining} onChangeText={(bonusMonthsRemaining) => updateProjection({ bonusMonthsRemaining })} suffix="months" editable={inputsEditable} error={errors.bonusMonths} />
              </Row>
              <SavingsQualificationEditor inputs={projectionInputs} editable={inputsEditable} onChange={updateProjection} />
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
            <NumericField label="Deposit amount" value={scenario.termDeposit.balance} onChangeText={(balance) => updateDeposit({ balance })} prefix="$" editable={inputsEditable} error={errors.tdBalance} />
            <NumericField label="Term" value={projectionInputs.termMonths} onChangeText={(termMonths) => updateProjection({ termMonths })} suffix="months" editable={inputsEditable} error={errors.termMonths} />
          </Row>
        </>
      )}
      {section !== 'TD' && (section === 'Savings' || projectionInputs.mortgageRateStructure === 'variable') ? <CompactToggle label="Variable rate held" value={projectionInputs.holdVariableRate} onChange={holdVariableRate => { if (inputsEditable) updateProjection({ holdVariableRate }); }} /> : null}
      {scenario.currentProducts[projectionKey].productKey ? <PublicRateEvidence productKey={scenario.currentProducts[projectionKey].productKey} programmeId={scenario.currentProducts[projectionKey].programmeId} compact /> : null}
      {target.status === 'available' ? <><PublicRateEvidence productKey={target.row.product_key} row={target.row} /><PublicCostComparison section={section} target={target.row} scenario={calculationScenario} /></> : null}
      <Pressable
        onPress={toggleAdvanced}
        accessibilityRole="button"
        accessibilityLabel={uiJoin(advanced ? 'Hide':'Show',' ','Assumptions')}
        style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <AppText variant="body" weight="700" style={{ flex: 1 }}>{uiLabel("Assumptions")}</AppText>
        <Ionicons name={advanced ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.primary} />
      </Pressable>
    </Card>
  );

  const advancedFields = advanced ? (
    <Card style={{ gap: 14 }}>
      <View>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="h3">{uiLabel("Approximate history")}</AppText>
          <Badge label="Optional" tone="muted" />
        </Row>
      </View>
      <Row gap={10} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <NumericField label="Starting date" value={projectionInputs.startDate} onChangeText={(startDate) => updateProjection({ startDate })} placeholder="YYYY-MM-DD" date editable={inputsEditable} error={errors.startDate} />
        <NumericField label="Starting balance" value={projectionInputs.startBalance} onChangeText={(startBalance) => updateProjection({ startBalance })} prefix="$" editable={inputsEditable} error={errors.startBalance} />
        <NumericField label="Starting rate" value={projectionInputs.startRate} onChangeText={(startRate) => updateProjection({ startRate })} suffix="%" editable={inputsEditable} error={errors.startRate} />
      </Row>
      {section === 'Mortgage' ? (
        <>
          <NumericField label="Starting offset balance" value={projectionInputs.startOffsetBalance} onChangeText={(startOffsetBalance) => updateProjection({ startOffsetBalance })} prefix="$" editable={inputsEditable} error={errors.startOffsetBalance} />
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
            label="Offset boost"
            value={projectionInputs.offsetBoostAmount}
            onChangeText={(offsetBoostAmount) => updateProjection({ offsetBoostAmount })}
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
          <NumericField label="Rollovers after first maturity" value={projectionInputs.rollovers} onChangeText={(rollovers) => updateProjection({ rollovers })} editable={inputsEditable} error={errors.rollovers} />
          <NumericField label="Local renewal rate" value={projectionInputs.renewalRate} onChangeText={renewalRate => updateProjection({ renewalRate })} suffix="%" editable={inputsEditable} />
          <CompactToggle label="Renewal rate unchanged" value={projectionInputs.holdVariableRate} onChange={holdVariableRate => { if (inputsEditable) updateProjection({ holdVariableRate }); }} />
          <CompactToggle label="Reinvest modelled interest" value={projectionInputs.reinvestInterest} onChange={(reinvestInterest) => { if (inputsEditable) updateProjection({ reinvestInterest }); }} />
        </>
      )}
      <View style={{ height: 1, backgroundColor: theme.colors.border }} />
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <AppText variant="body" weight="700">{uiLabel("Rate range")}</AppText>
        <AppText variant="tiny" color="textMuted">{uiLabel("Default ±1 pp")}</AppText>
      </Row>
      <Row gap={10} style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <NumericField label="Lower scenario" value={projectionInputs.lowerRate} onChangeText={(lowerRate) => updateProjection({ lowerRate })} placeholder="Automatic" suffix="%" editable={inputsEditable} error={errors.lowerRate} />
        <NumericField label="Higher scenario" value={projectionInputs.higherRate} onChangeText={(higherRate) => updateProjection({ higherRate })} placeholder="Automatic" suffix="%" editable={inputsEditable} error={errors.higherRate} />
      </Row>
    </Card>
  ) : null;

  const chartCard = (
    <Card style={{ gap: 14 }}>
      <View>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <AppText variant="h3">{uiLabel("Your rate scenario")}</AppText>
            <AppText variant="tiny" color="textMuted">{uiJoin("As at",": ",uiDate(result.asAt))}</AppText>
          </View>
          <Badge label="Illustrative" tone="primary" />
        </Row>
      </View>
      {!result.ready ? (
        <View style={{ gap: 12 }}>
          <AppText variant="body" color="textMuted">{uiLabel("Inputs incomplete")}</AppText>
          <Button
            title="Rate check"
            variant="secondary"
            onPress={() => { void flush().then((saved) => { if (saved) router.setParams({ mode: 'check' }); }); }}
          />
        </View>
      ) : (
        <>
          {section === 'Mortgage' ? (
            <SegmentedControl
              options={[
                { label: uiLabel("Rate scenarios"), value: 'rates' },
                { label: uiLabel("Offset scenarios"), value: 'offsets' },
              ]}
              value={dimension}
              onChange={changeDimension}
            />
          ) : null}
          <View>
            <AppText variant="tiny" color="textFaint" weight="700" style={{ marginBottom: 8 }}>{uiLabel('Y-axis')}</AppText>
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
      <SelectedCalculationTarget target={target} scenario={scenario} identityOnly constraint={targetConstraint} rateConditionContext={rateConditionContext} />
      {storageStatus !== 'ready' || storageError ? (
        <Card style={{ gap: 8 }}>
          <AppText variant="small" weight="700">
            {uiLabel(storageStatus === 'loading' || storageStatus === 'idle'
              ? 'Loading'
              : saveStatus === 'saving'
                ? 'Saving'
                : saveStatus === 'saved'
                  ? 'Saved'
                  : storageStatus === 'error'
                    ? 'Scenario unavailable'
                    : 'Reset')}
          </AppText>
          {storageStatus === 'error' ? (
            <Button title="Retry encrypted storage" variant="secondary" onPress={() => void retryLoad()} />
          ) : null}
        </Card>
      ) : null}
      {target.status !== 'available' ? <SegmentedControl options={SECTION_OPTIONS} value={section} onChange={changeSection} /> : null}
      {wide ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 16 }}>
          <View style={{ flex: 0.9, gap: 12 }}>{basicFields}{advancedFields}</View>
          <View style={{ flex: 1.25 }}>{chartCard}</View>
        </View>
      ) : (
        <View style={{ gap: 12 }}>{basicFields}{advancedFields}{chartCard}</View>
      )}
      {target.status === 'available' && section !== 'Mortgage' ? (
        <Card style={{ gap: 8 }}>
          <SelectedCalculationTarget target={target} scenario={scenario} constraint={targetConstraint} rateConditionContext={rateConditionContext} />
        </Card>
      ) : null}
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <AppText variant="tiny" color="textMuted">{uiLabel("Storage")}</AppText>
        <AppText variant="tiny">{Platform.OS === 'web' ? uiJoin('This tab',' · ','Until close') : uiJoin('This device',' · ','Encrypted')}</AppText>
        <AppText variant="tiny" color="textMuted">{uiLabel("Session replay")}</AppText>
        <AppText variant="tiny">{uiLabel("Blocked")}</AppText>
      </Row>
      {saveStatus === 'saving' || saveStatus === 'saved' ? <AppText variant="tiny" color="textMuted">{uiLabel(saveStatus === 'saving' ? 'Saving':'Saved')}</AppText>:null}
      {result.ready ? (
        <Card style={{ gap: 8 }}>
          <AppText variant="h3">{uiLabel("Model facts")}</AppText>
          <ProjectionFactRows facts={result.facts} />
        </Card>
      ) : null}
      {staySwitch?.ready ? (
        <StaySwitchChart projection={staySwitch} currentBank={currentBankLabel} />
      ) : null}
      <View>
        <Button
          title="Matching rates"
          icon="search-outline"
          onPress={() => { void flush().then((saved) => { if (saved) openBrowse(section); }); }}
          disabled={storageStatus !== 'ready'}
        />
      </View>
    </ScreenScrollView>
  );
}
