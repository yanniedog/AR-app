import { LocalRateEditor } from '../scenario/LocalRateEditor';
import { PublicPricingCoverage } from '../scenario/PublicPricingCoverage';
import { PublicCostComparison } from '../scenario/PublicCostComparison';
import { SavingsQualificationEditor } from '../scenario/SavingsQualificationEditor';
import { usePublicRateCatalogue } from '../../data/publicRateCatalogue';
import { publicRateScenario, resolveLocalCurrentRate, scenarioWithLocalCurrentRate, resolveRowPublicRate, payableRateForRow } from '../../data/publicRateIntegration';
import { useResolvedPublicRankingRows } from '../../hooks/useResolvedPublicRankingRows';
import { uiCount, uiDuration, uiInputNumber, uiJoin, uiLabel, uiMoney, uiNumber, uiProductName, uiProviderName, uiSectionName, type UiCopy, type UiText } from "../../lib/uiCopy";
import { uiAccessBadge, uiListedLvr, uiTargetConstraint } from "../../lib/financialUiCopy";
import { fontStyle } from '../../theme/fonts';
import { router, useLocalSearchParams } from 'expo-router';
import React, { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, TextInput, useWindowDimensions, View } from 'react-native';

import { IndeterminateProgressBar, ScreenSkeleton } from '../../components/feedback';
import { BankAvatar } from '../../components/BankAvatar';
import {
  ProductRateChangeSummaryLine,
} from '../../components/product/ProductRateChangeLine';
import { ProfileEditor } from '../../components/ProfileEditor';
import { CurrentBankPicker } from '../../components/scenario/CurrentBankPicker';
import { SwitchCostEditor } from '../../components/scenario/SwitchCostEditor';
import { ScreenScrollView } from '../../components/Screen';
import { CompactToggle, SegmentedControl } from '../../components/controls';
import { AppText, Badge, Button, Card, Disclosure, Row } from '../../components/ui';
import { SECTIONS, SECTION_ORDER } from '../../constants';
import { assessAccess } from '../../data/access';
import { verifiedDetailsSha } from '../../data/detailsIdentity';
import type { RateConditionContext } from '../../data/rateConditions';
import {
  advertisedTermMonths,
  calculatorAmount,
  calculatorYears,
  computeLvr,
  depositToReachLvr,
  isPublishedFixedRate,
  MAX_CALCULATOR_DEPOSIT_AMOUNT,
  MAX_CALCULATOR_MORTGAGE_AMOUNT,
  MAX_CALCULATOR_YEARS,
  quickEstimateUnavailableReason,
  termDepositInterestDifference,
  type CalcInputs,
} from '../../data/calc';
import { formatRate, visibleAccountRows } from '../../data/format';
import type { CurrentProductReference, MortgageSwitchInputs } from '../../data/userRateScenario';
import { bestRateForProduct, summarizeProductBestRate } from '../../data/productHistory';
import {
  lvrTierForValue,
  parseLvrTier,
  profileFeaturesForSection,
  scenarioProfileFilterRows,
} from '../../data/profile';
import { distinctValues, rankFraction } from '../../data/selectors';
import { isSuitabilityFilterReady } from '../../data/suitabilityGate';
import { useStore } from '../../data/store';
import { useUserRateScenario } from '../../hooks/useUserRateScenario';
import { usePerformanceAuditSurface } from '../../hooks/usePerformanceAuditReadiness';
import { useSuitabilityRevision } from '../../hooks/useSuitabilityRevision';
import { rowsUnder } from '../../data/taxonomy';
import { CALCULATOR_FIELDS } from '../../lib/calculatorIssues';
import { openProduct } from '../../lib/nav';
import { auditActionString } from '../../lib/performanceAuditActionParams';
import { applyCalculatorAuditSection } from '../../lib/calculatorAuditSelection';
import { useLogoReadiness } from '../../hooks/useLogoReadiness';
import { type RateRow, type SectionKey } from '../../types';
import { useScenarioSection } from '../../hooks/useScenarioSection';
import { useTheme } from '../../theme/ThemeProvider';
import { resolveCalculationTarget } from '../../lib/calculationTarget';
import { selectedTargetConstraint, selectedTargetConstraintLabel, targetConstraintContradicted } from '../../lib/selectedTargetConstraints';
import { SelectedCalculationTarget } from './SelectedCalculationTarget';
import { OpaquePerformanceAuditRenderRevision } from '../../lib/performanceAuditReadiness';

function monthlyPayment(balance: number, annualRate: number, months: number): number {
  const r = annualRate / 12;
  if (r <= 0) return balance / months;
  return (r * balance) / (1 - Math.pow(1 + r, -months));
}

const formatDollars = (n: number): UiText => uiMoney(n);

interface Candidate {
  row: RateRow;
  rate: number; // configured ranking metric shown for transparency
  projectionRate: number; // contractual/headline rate used for arithmetic
  perMonth: number | null; // mortgage: initial repayment difference per month
  total: number | null; // deposits: simple annual or published-maturity difference
  totalLabel: UiCopy;
  unavailableReason: string | null;
}

function verifiedSelectedDetails(row:RateRow,section:SectionKey,context:RateConditionContext):boolean {
  const {core,details,manifest,coreIntegrity}=context;
  return !!core && !!details && !!manifest && !!coreIntegrity
    && coreIntegrity.core===core && coreIntegrity.runDate===core.run_date
    && coreIntegrity.coreSha256===manifest.files.core.sha256
    && !!manifest.files.details.sha256 && verifiedDetailsSha(details)===manifest.files.details.sha256
    && core.run_date===details.run_date && core.run_date===manifest.run_date
    && core.sections[section].rates.includes(row) && Object.hasOwn(details.products,row.product_key)
    && !!details.products[row.product_key];
}

export function RateCheckWorkspace() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const compactFields = width < 380;
  const core = useStore((s) => s.core);
  const manifest = useStore((s) => s.manifest);
  const publicCatalogue = usePublicRateCatalogue(manifest);
  const storeStatus = useStore((s) => s.status);
  const storeError = useStore((s) => s.error);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? '');
  const coreIntegrity = useStore((s) => s.coreIntegrity);
  const details = useStore((s) => s.details);
  const detailsLoading = useStore((s) => s.detailsLoading);
  const productHistory = useStore((s) => s.productHistory);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const profileFilters = useStore((s) => s.prefs.profileFilters);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const setPref = useStore((s) => s.setPref);
  const activeSection = useStore((s) => s.activeSection);
  const params = useLocalSearchParams<{ intent?: string; section?: string; target?: string | string[]; ri?: string | string[]; programme?: string | string[] }>();
  const [section] = useScenarioSection(activeSection);
  const changeSection = useCallback((next: SectionKey) => router.setParams({ section: next, target: undefined, ri: undefined }), []);
  const [layoutReady, setLayoutReady] = useState(false);
  const [detailsTerminalError, setDetailsTerminalError] = useState(false);
  const [targetDetailsTerminalKey,setTargetDetailsTerminalKey]=useState<string|null>(null);
  const [targetDetailsRetry,setTargetDetailsRetry]=useState<{key:string;count:number}|null>(null);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [leftFields, setLeftFields] = useState<ReadonlySet<string>>(() => new Set());
  const appliedCheckIntent = useRef('');
  const renderRevisionTracker = useRef(new OpaquePerformanceAuditRenderRevision());
  const sectionOptions = useMemo(() => SECTION_ORDER.map(value => ({ value, label: uiSectionName(value) })), []);
  const suitabilityRevision = useSuitabilityRevision();
  const {
    scenario,
    storageStatus: scenarioStorageStatus,
    saveStatus: scenarioSaveStatus,
    error: scenarioError,
    update: updateScenario,
    flush: flushScenario,
    retryLoad: retryScenarioLoad,
  } = useUserRateScenario();
  const suitabilityReady = useMemo(() => {
    void suitabilityRevision;
    return isSuitabilityFilterReady(includeNonStandard);
  }, [includeNonStandard, suitabilityRevision]);

  const profileFeaturesPending =
    profileFeaturesForSection(profileFilters, section).length > 0 && !details?.products;

  useEffect(() => {
    if (!profileFeaturesPending) {
      setDetailsTerminalError(false);
      return;
    }
    let cancelled = false;
    setDetailsTerminalError(false);
    void ensureDetails()
      .then(() => {
        if (!cancelled && !useStore.getState().details?.products) setDetailsTerminalError(true);
      })
      .catch(() => {
        if (!cancelled) setDetailsTerminalError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [profileFeaturesPending, ensureDetails]);

  const isLoan = SECTIONS[section].lowerIsBetter;
  const isMortgage = section === 'Mortgage';

  const inputs = scenario.mortgage;
  const localRateResolution = resolveLocalCurrentRate(section, scenario, publicCatalogue.references, undefined, publicCatalogue, profileFilters);
  const calculationScenario = scenarioWithLocalCurrentRate(section, scenario, localRateResolution);
  const { status: publicCatalogueStatus, allLoaded: publicAllLoaded, loadAll: loadPublicCatalogue } = publicCatalogue;
  useEffect(() => {
    if (publicCatalogueStatus === 'ready' && !publicAllLoaded) void loadPublicCatalogue().catch(() => undefined);
  }, [publicCatalogueStatus, publicAllLoaded, loadPublicCatalogue]);
  const upd = (patch: Partial<CalcInputs>) =>
    updateScenario((prev) => ({ ...prev, mortgage: { ...prev.mortgage, ...patch } }));
  const scenarioSectionKey = section === 'Mortgage' ? 'mortgage' : section === 'TD' ? 'termDeposit' : 'savings';
  const savedCurrentProduct = scenario.currentProducts[scenarioSectionKey];
  const currentProduct = savedCurrentProduct;
  const updateCurrentProduct = (value: CurrentProductReference) => updateScenario((prev) => ({
    ...prev,
    currentProducts: { ...prev.currentProducts, [scenarioSectionKey]: value },
  }));
  const updateSwitch = (patch: Partial<MortgageSwitchInputs>) => updateScenario((prev) => ({
    ...prev,
    mortgageSwitch: { ...prev.mortgageSwitch, ...patch },
  }));

  useEffect(() => {
    if (!currentProduct.productKey || details?.products?.[currentProduct.productKey] || detailsLoading) return;
    void ensureDetails({ forProductView: true });
  }, [currentProduct.productKey, details?.products, detailsLoading, ensureDetails]);

  useEffect(() => {
    const intentKey = `${params.intent ?? ''}:${section}`;
    if (
      params.intent !== 'check'
      || section !== 'Mortgage'
      || scenarioStorageStatus !== 'ready'
      || appliedCheckIntent.current === intentKey
    ) return;
    appliedCheckIntent.current = intentKey;
    if (scenario.mortgage.mode !== 'refi') {
      updateScenario((previous) => ({
        ...previous,
        mortgage: { ...previous.mortgage, mode: 'refi' },
      }));
    }
  }, [params.intent, scenario.mortgage.mode, scenarioStorageStatus, section, updateScenario]);

  const lvrResult = useMemo(() => computeLvr(inputs), [inputs]);
  const lvr = isMortgage ? lvrResult.lvr : null;
  const availableLvrTiers = useMemo(
    () => distinctValues(core?.sections?.Mortgage?.rates ?? [], 'lvr_tier'),
    [core],
  );
  const lvrBand = lvr !== null ? lvrTierForValue(lvr, availableLvrTiers) : null;

  const calculatorSectionScenario = useMemo(
    () => publicRateScenario(section, scenario, profileFilters),
    [section, scenario, profileFilters],
  );
  const calculatorRowScenario = useCallback(
    (row: RateRow) => publicRateScenario(section, scenario, profileFilters, row),
    [section, scenario, profileFilters],
  );
  // Expand + price cooperatively. Sync publicRecommendationRows here previously
  // monopolised Hermes on every calculator section/scenario change.
  const pricedCatalogue = useResolvedPublicRankingRows({
    sourceRows: core?.sections?.[section]?.rates ?? [],
    catalogue: publicCatalogue,
    section,
    sectionScenario: calculatorSectionScenario,
    rowScenario: calculatorRowScenario,
    focused: true,
    revision: suitabilityRevision,
  });
  const publicPricing = pricedCatalogue.resolution;
  const comparisonsReady = publicCatalogue.status === 'unavailable'
    || (pricedCatalogue.ready && publicPricing.complete);
  const unpricedRows = useMemo(() => {
    void suitabilityRevision;
    if (!pricedCatalogue.ready) return [];
    return visibleAccountRows(
      scenarioProfileFilterRows(
        rowsUnder(pricedCatalogue.candidates, section, []),
        profileFilters,
        section,
        lvr,
        details?.products,
      ),
      includeNonStandard,
      details?.products,
    );
  }, [pricedCatalogue.ready, pricedCatalogue.candidates, section, profileFilters, includeNonStandard, details, lvr, suitabilityRevision]);
  const rows = useMemo(() => {
    void suitabilityRevision;
    if (!pricedCatalogue.ready) return [];
    return visibleAccountRows(
      scenarioProfileFilterRows(
        rowsUnder(publicPricing.rows, section, []),
        profileFilters,
        section,
        lvr,
        details?.products,
      ),
      includeNonStandard,
      details?.products,
    );
  }, [pricedCatalogue.ready, publicPricing.rows, section, profileFilters, includeNonStandard, details, lvr, suitabilityRevision]);
  const target = useMemo(() => {
    void suitabilityRevision;
    return resolveCalculationTarget(() => {
      if (!core) return null;
      // Raw core lacks public programme bindings. While cooperative pricing is
      // outstanding, stay pending so audit readiness waits instead of erroring.
      if (publicCatalogue.status === 'unavailable') return core;
      if (!pricedCatalogue.ready) return null;
      return {
        ...core,
        sections: {
          ...core.sections,
          [section]: {
            ...core.sections[section],
            rates: pricedCatalogue.candidates,
          },
        },
      };
    }, section, { target: params.target, ri: params.ri, programme: params.programme });
  }, [core, section, params.target, params.ri, params.programme, suitabilityRevision, publicCatalogue.status, pricedCatalogue.ready, pricedCatalogue.candidates]);
  const targetDetailsKey=JSON.stringify([coreSha,manifest?.files.details.sha256,
    target.status==='available'?target.row.product_key:null,target.status==='available'?target.row.rate_index:null]);
  const targetDetailsRetryCount=targetDetailsRetry?.key===targetDetailsKey?targetDetailsRetry.count:0;
  const targetDetailsVerified=target.status==='available' && verifiedSelectedDetails(target.row,section,{core,details,manifest,coreIntegrity});
  const targetDetailsMissing=target.status==='available' && !targetDetailsVerified;
  const targetDetailsFailed=targetDetailsMissing && targetDetailsTerminalKey===targetDetailsKey;
  useEffect(()=>{
    if(target.status!=='available' || targetDetailsVerified) return;
    let active=true;
    setTargetDetailsTerminalKey(null);
    void (async()=>{
      try {
        await ensureDetails({forProductView:true,...(targetDetailsRetryCount>0?{force:true,abandonInFlight:true}:{})});
      } catch { /* The closed error state retains the exact selected rate. */ }
      const current=useStore.getState();
      if(active && !verifiedSelectedDetails(target.row,section,current)) setTargetDetailsTerminalKey(targetDetailsKey);
    })();
    return()=>{active=false;};
  },[ensureDetails,section,target,targetDetailsKey,targetDetailsRetryCount,targetDetailsVerified]);

  // ---- LVR (mortgage): a real calculation from several inputs ----
  // Deposit needed to drop into the next lower LVR band (better rates).
  const nextBandHint = useMemo(() => {
    if (!isMortgage || inputs.mode !== 'buy' || !lvrBand) return null;
    const band = parseLvrTier(lvrBand);
    const propertyValue = calculatorAmount(inputs.propertyValue, MAX_CALCULATOR_MORTGAGE_AMOUNT);
    if (!band || band.lo <= 0 || propertyValue == null || propertyValue <= 0) return null;
    const extra = depositToReachLvr(propertyValue, lvrResult.depositApplied, band.lo);
    if (extra <= 0) return null;
    return { extra, targetPct: band.lo };
  }, [isMortgage, inputs.mode, inputs.propertyValue, lvrBand, lvrResult.depositApplied]);

  // Loan amount that drives the savings comparison.
  const depositInputs = section === 'TD' ? scenario.termDeposit : scenario.savings;
  const depositBalance = calculatorAmount(depositInputs.balance, MAX_CALCULATOR_DEPOSIT_AMOUNT);
  const balance = isMortgage ? lvrResult.loan ?? 0 : depositBalance ?? 0;
  const currentRateInput = isMortgage ? calculationScenario.mortgage.currentRate : section === 'TD' ? calculationScenario.termDeposit.currentRate : calculationScenario.savings.currentRate;
  const currentRate = localRateResolution.status === 'exact' && localRateResolution.payableRate != null ? Number(localRateResolution.payableRate) : null;
  const rateConditionContext = useMemo(() => ({ core, details, manifest, coreIntegrity }), [core, details, manifest, coreIntegrity]);
  const targetConstraint = useMemo(() => target.status === 'available'
    ? selectedTargetConstraint(target.row, section, scenario, rateConditionContext) : undefined,
  [target, section, scenario, rateConditionContext]);
  const years = calculatorYears(inputs.years);
  const months = years == null ? 0 : Math.round(years * 12);
  const issues: {message:UiCopy;emptyField?:string}[] = [];
  const invalid = (message: UiCopy) => { issues.push({ message }); };
  const empty = (emptyField: string, message: UiCopy) => { issues.push({ message, emptyField }); };
  if (isMortgage) {
    const propertyField = inputs.mode === 'refi' ? CALCULATOR_FIELDS.propertyValue : CALCULATOR_FIELDS.propertyPrice;
    if (!inputs.propertyValue.trim()) empty(propertyField, uiJoin('Property value',': ','Required'));
    else if (calculatorAmount(inputs.propertyValue, MAX_CALCULATOR_MORTGAGE_AMOUNT) == null) {
      invalid(uiJoin('Property value',': ',uiMoney(0),'–',uiMoney(MAX_CALCULATOR_MORTGAGE_AMOUNT)));
    }
    if (inputs.mode === 'refi') {
      if (!inputs.loanBalance.trim()) empty(CALCULATOR_FIELDS.loanBalance, uiJoin('Loan balance',': ','Required'));
      else if (calculatorAmount(inputs.loanBalance, MAX_CALCULATOR_MORTGAGE_AMOUNT) == null) {
        invalid(uiJoin('Loan balance',': ',uiMoney(0),'–',uiMoney(MAX_CALCULATOR_MORTGAGE_AMOUNT)));
      }
    } else {
      if (inputs.deposit.trim() && calculatorAmount(inputs.deposit, MAX_CALCULATOR_MORTGAGE_AMOUNT) == null) {
        invalid(uiJoin('Savings',': ',uiMoney(0),'–',uiMoney(MAX_CALCULATOR_MORTGAGE_AMOUNT)));
      }
      if (inputs.costs.trim() && calculatorAmount(inputs.costs, MAX_CALCULATOR_MORTGAGE_AMOUNT) == null) {
        invalid(uiJoin('Upfront costs',': ',uiMoney(0),'–',uiMoney(MAX_CALCULATOR_MORTGAGE_AMOUNT)));
      }
    }
    if (lvrResult.loan != null && lvrResult.loan <= 0) invalid(uiJoin('Loan needed',': ','>',uiMoney(0)));
    if (!inputs.years.trim()) empty(CALCULATOR_FIELDS.years, uiJoin('Years remaining',': ','Required'));
    else if (years == null) invalid(uiJoin('Years remaining',': ','>',0,'–',uiCount(MAX_CALCULATOR_YEARS),' ','years'));
  } else if (!depositInputs.balance.trim()) {
    empty(CALCULATOR_FIELDS.depositBalance, section === 'TD' ? uiJoin('Deposit amount',': ','Required') : uiJoin('Balance',': ','Required'));
  } else if (depositBalance == null || depositBalance <= 0) {
    invalid(uiJoin('Balance',': ','>',uiMoney(0),'–',uiMoney(MAX_CALCULATOR_DEPOSIT_AMOUNT)));
  }
  if (!currentRateInput.trim()) empty(CALCULATOR_FIELDS.currentRate, uiJoin('Current rate',': ','Required'));
  else if (currentRate == null) invalid(uiJoin('Current rate',': ',0,'–',100,'%'));
  const inputIssues = issues.map((issue) => issue.message);
  // Empty fields are flagged once they have been left, not before any input.
  const shownInputIssues = issues.filter(issue => !issue.emptyField || leftFields.has(issue.emptyField)).map(issue => issue.message);
  const inputIssueKey = inputIssues.join('|');

  const candidates = useMemo<Candidate[]>(() => {
    if (!comparisonsReady || inputIssueKey || currentRate === null || balance <= 0 || (isLoan && months <= 0)) return [];
    const pricedOffers: { row: RateRow; rate: number; projectionRate: number }[] = [];
    const seen = new Set<string>();
    const candidateRows = target.status === 'available' ? [target.row] : target.status === 'none' ? rows : [];
    for (const row of candidateRows) {
      const v = rankFraction(row, section, depositRankMetric, mortgageRateMetric);
      if (v === null) continue;
      const token = row.public_offer_id ?? `${row.product_key}:${row.rate_index ?? ''}`;
      if (seen.has(token)) continue;
      seen.add(token);
      const resolution = resolveRowPublicRate(row, publicCatalogue, publicRateScenario(section, scenario, profileFilters, row));
      const projectionRate = payableRateForRow(row, resolution);
      if (projectionRate !== null) pricedOffers.push({ row, rate: v, projectionRate });
    }
    const out: Candidate[] = [];
    for (const { row, rate, projectionRate } of pricedOffers) {
      if (target.status === 'none' && (isLoan ? projectionRate >= currentRate : projectionRate <= currentRate)) continue;
      if(target.status==='available' && !targetDetailsVerified) {
        out.push({row,rate,projectionRate,perMonth:null,total:null,totalLabel:'Rate only',unavailableReason:'Sources unverified'});
        continue;
      }
      if (targetConstraint && targetConstraintContradicted(targetConstraint)) {
        out.push({ row, rate, projectionRate, perMonth: null, total: null, totalLabel: 'Rate only',
          unavailableReason: selectedTargetConstraintLabel(targetConstraint) });
        continue;
      }
      if (isLoan) {
        if (!scenario.projections.mortgage.holdVariableRate && !isPublishedFixedRate(row)) {
          out.push({ row, rate, projectionRate, perMonth: null, total: null, totalLabel: 'Rate only', unavailableReason: 'Rate assumption missing' });
          continue;
        }
        const perMonth = monthlyPayment(balance, currentRate, months) - monthlyPayment(balance, projectionRate, months);
        const fixedMonths = isPublishedFixedRate(row) ? advertisedTermMonths(row) : null;
        out.push({
          row,
          rate,
          projectionRate,
          perMonth,
          total: null,
          totalLabel: fixedMonths
            ? uiJoin('Initial repayment',' · ',uiDuration(Math.min(months,fixedMonths),'months'),' · ','Fixed period')
            : 'Initial monthly repayment',
          unavailableReason: null,
        });
      } else {
        const unavailableReason = quickEstimateUnavailableReason(row, section)
          ?? (section === 'Savings' && !scenario.projections.savings.holdVariableRate
            ? 'Rate assumption missing' : null);
        if (unavailableReason) {
          out.push({ row, rate, projectionRate, perMonth: null, total: null, totalLabel: 'Rate only', unavailableReason });
          continue;
        }
        const perYear = balance * (projectionRate - currentRate);
        const maturityMonths = section === 'TD' ? advertisedTermMonths(row) : null;
        const total = maturityMonths
          ? termDepositInterestDifference(balance, currentRate, projectionRate, maturityMonths)
          : perYear;
        out.push({
          row,
          rate,
          projectionRate,
          perMonth: null,
          total,
          totalLabel: maturityMonths ? uiJoin(uiDuration(maturityMonths,'months'),' · ','Maturity') : 'Simple annual interest',
          unavailableReason: null,
        });
      }
    }
    return out.sort((a, b) => {
      const aEstimate = a.perMonth ?? a.total;
      const bEstimate = b.perMonth ?? b.total;
      if (aEstimate == null && bEstimate == null) return isLoan
        ? a.projectionRate - b.projectionRate
        : b.projectionRate - a.projectionRate;
      if (aEstimate == null) return 1;
      if (bEstimate == null) return -1;
      return bEstimate - aEstimate;
    }).slice(0, 10);
  }, [rows, target, targetConstraint,targetDetailsVerified, currentRate, balance, months, isLoan, section, depositRankMetric, mortgageRateMetric, inputIssueKey, comparisonsReady, scenario, publicCatalogue, profileFilters]);
  const currentProductDetail = currentProduct.productKey
    ? details?.products?.[currentProduct.productKey] ?? null
    : null;
  const leadingTargetKey = target.status === 'available' ? target.row.product_key : candidates[0]?.row.product_key;
  const leadingTargetDetail = leadingTargetKey
    ? details?.products?.[leadingTargetKey] ?? null
    : null;

  const auditSelectSection = useCallback((...args: unknown[]) => {
    const requested = auditActionString(args, 'section');
    const requestedSection=SECTION_ORDER.find(value=>value===requested);
    if (requestedSection) {
      return applyCalculatorAuditSection(section, requestedSection, changeSection);
    }
    const currentIndex = sectionOptions.findIndex((option) => option.value === section);
    const next = sectionOptions[(currentIndex + 1) % Math.max(1, sectionOptions.length)]?.value;
    if (next) changeSection(next);
  }, [changeSection, section, sectionOptions]);
  const openFirstCandidate = useCallback(() => {
    const candidate = candidates[0];
    if (!candidate) {
      return {
        unavailableReason:
          'No better comparable calculator candidates are available for the current scenario inputs',
      };
    }
    openProduct(candidate.row.product_key, candidate.row.rate_index, candidate.row.public_programme_id);
    return { expectedPath: `/product/${encodeURIComponent(candidate.row.product_key)}` };
  }, [candidates]);
  const openProjections = useCallback(async () => {
    const saved = await flushScenario();
    if (!saved) {
      return { unavailableReason: 'Encrypted calculator scenario could not be flushed before projections' };
    }
    router.setParams({ mode: 'project' });
    return { expectedPath: '/calculator' };
  }, [flushScenario]);
  const auditToggleMode = useCallback((...args: unknown[]) => {
    if (scenarioStorageStatus !== 'ready') {
      return { unavailableReason: 'Encrypted calculator scenario is not ready' };
    }
    if (!isMortgage) {
      return { unavailableReason: 'Buy/refi mode only applies on the mortgage calculator' };
    }
    const requested = auditActionString(args, 'mode');
    const mode: CalcInputs['mode'] =
      requested === 'buy' || requested === 'refi'
        ? requested
        : inputs.mode === 'buy'
          ? 'refi'
          : 'buy';
    startTransition(() => {
      updateScenario((prev) => ({ ...prev, mortgage: { ...prev.mortgage, mode } }));
    });
    return { mode };
  }, [inputs.mode, isMortgage, scenarioStorageStatus, updateScenario]);
  const auditApplyScenario = useCallback((...args: unknown[]) => {
    if (scenarioStorageStatus !== 'ready') {
      return { unavailableReason: 'Encrypted calculator scenario is not ready' };
    }
    const modeRaw = auditActionString(args, 'mode');
    const mode: CalcInputs['mode'] | null =
      modeRaw === 'buy' || modeRaw === 'refi' ? modeRaw : null;
    const propertyValue = auditActionString(args, 'propertyValue');
    const deposit = auditActionString(args, 'deposit');
    const costs = auditActionString(args, 'costs');
    const loanBalance = auditActionString(args, 'loanBalance');
    const currentRate = auditActionString(args, 'currentRate');
    const years = auditActionString(args, 'years');
    const balance = auditActionString(args, 'balance');
    if (section === 'Mortgage') {
      if (!mode && !propertyValue && !deposit && !costs && !loanBalance && !currentRate && !years) {
        return {
          unavailableReason: 'Mortgage calculator apply requires mode and/or mortgage input parameters',
        };
      }
      updateScenario((prev) => ({
        ...prev,
        localRates: { ...prev.localRates, mortgage: { ...prev.localRates.mortgage, mode: 'entered' } },
        mortgage: {
          ...prev.mortgage,
          ...(mode ? { mode } : {}),
          ...(propertyValue ? { propertyValue } : {}),
          ...(deposit ? { deposit } : {}),
          ...(costs ? { costs } : {}),
          ...(loanBalance ? { loanBalance } : {}),
          ...(currentRate ? { currentRate } : {}),
          ...(years ? { years } : {}),
        },
      }));
      return {
        applied: 'mortgage',
        mode: mode ?? inputs.mode,
      };
    }
    if (!balance && !currentRate) {
      return { unavailableReason: 'Deposit calculator apply requires balance and/or currentRate parameters' };
    }
    updateScenario((prev) => {
      const key = section === 'TD' ? 'termDeposit' : 'savings';
      return {
        ...prev,
        [key]: {
          ...prev[key],
          ...(balance ? { balance } : {}),
          ...(currentRate ? { currentRate } : {}),
        },
      };
    });
    return { applied: section === 'TD' ? 'termDeposit' : 'savings' };
  }, [inputs.mode, scenarioStorageStatus, section, updateScenario]);
  const coreRevision = core ? `${core.run_date}:${coreSha}` : null;
  const calculatorRenderRevision = `${coreRevision ?? 'none'}:${renderRevisionTracker.current.update([
    section, scenarioStorageStatus, scenario, params.target, params.ri, candidates,
  ])}`;
  const calculatorLogoIds = useMemo(
    () => candidates.map((candidate) =>
      `calculator:${candidate.row.product_key}:${candidate.row.rate_index ?? 'none'}`),
    [candidates],
  );
  const calculatorLogos = useLogoReadiness(calculatorRenderRevision, calculatorLogoIds);
  const auditActions = useMemo(() => ({
    'calculator.open': () => undefined,
    'calculator.section.next': auditSelectSection,
    'calculator.section.savings': auditSelectSection,
    'calculator.section.mortgage': auditSelectSection,
    'calculator.section.return-mortgage': auditSelectSection,
    'calculator.mode.next': auditToggleMode,
    'calculator.scenario.apply-buy': auditApplyScenario,
    'calculator.scenario.apply-refi': auditApplyScenario,
    'calculator.scenario.apply-deposit': auditApplyScenario,
    'calculator.candidate.first': openFirstCandidate,
    'calculator.projections.open': openProjections,
  }), [auditApplyScenario, auditSelectSection, auditToggleMode, openFirstCandidate, openProjections]);
  usePerformanceAuditSurface({
    id: 'calculator.results',
    routeKey: '/calculator',
    datasetRevision: coreRevision,
    renderRevision: calculatorRenderRevision,
    actions: auditActions,
    probes: [
      {
        id: 'calculator.data',
        kind: 'data',
        status: core ? 'ready' : storeStatus === 'error' ? 'error' : 'pending',
        error: !core && storeStatus === 'error' ? storeError ?? 'Core data unavailable' : null,
        datasetRevision: coreRevision,
      },
      {
        id: 'calculator.target',
        kind: 'data',
        status: target.status === 'pending' ? 'pending' : target.status === 'unavailable' ? 'error' : 'ready',
        error: target.status === 'unavailable' ? 'Selected calculation target is unavailable' : null,
      },
      {
        id: 'calculator.scenario-storage',
        kind: 'data',
        status: scenarioStorageStatus === 'ready'
          ? 'ready'
          : scenarioStorageStatus === 'error'
            ? 'error'
            : 'pending',
        error: scenarioStorageStatus === 'error' ? scenarioError ?? 'Encrypted scenario unavailable' : null,
      },
      {
        id: 'calculator.details',
        kind: 'data',
        status: !targetDetailsMissing && (!profileFeaturesPending || details?.products)
          ? 'ready'
          : targetDetailsFailed || detailsTerminalError
            ? 'error'
            : 'pending',
        error: targetDetailsFailed || detailsTerminalError
          ? 'Required product details are unavailable'
          : null,
        expectedCount: profileFeaturesPending || target.status==='available' ? 1 : 0,
        actualCount: !targetDetailsMissing && (profileFeaturesPending || target.status==='available') && details?.products ? 1 : 0,
      },
      {
        id: 'calculator.suitability',
        kind: 'data',
        status: suitabilityReady ? 'ready' : 'pending',
        datasetRevision: coreRevision,
      },
      {
        id: 'calculator.candidates',
        kind: 'list',
        status: targetDetailsFailed ? 'error' : !core || detailsLoading || targetDetailsMissing || !suitabilityReady ? 'pending' : 'ready',
        error:targetDetailsFailed?'Selected product details are unavailable':null,
        expectedCount: candidates.length,
        actualCount: candidates.length,
      },
      {
        id: 'calculator.logos',
        kind: 'logo',
        required: false,
        status: calculatorLogos.ready ? 'ready' : 'pending',
        expectedCount: calculatorLogos.expectedCount,
        actualCount: calculatorLogos.terminalCount,
        fallbackCount: calculatorLogos.fallbackCount,
      },
      {
        id: 'calculator.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
        renderRevision: calculatorRenderRevision,
      },
    ],
  });

  if (!core) return <ScreenSkeleton />;

  const inputStyle = {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
    color: theme.colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: theme.font.body,
  } as const;

  const field = (
    label: UiCopy,
    value: string,
    onChangeText: (t: string) => void,
    a11y: UiCopy,
    explicitWidth?: number,
  ) => (
    <View style={explicitWidth && !compactFields ? { width: explicitWidth } : { flex: 1, width: compactFields ? '100%' : undefined }}>
      <AppText variant="tiny" color="textFaint" style={{ marginBottom: 4 }}>
        {label}
      </AppText>
      <TextInput
        value={uiInputNumber(value)}
        onChangeText={onChangeText}
        keyboardType="numeric"
        editable={scenarioStorageStatus === 'ready'}
        maxLength={20}
        style={[fontStyle('400'), inputStyle]}
        accessibilityLabel={a11y}
        onBlur={() => setLeftFields((prev) => (prev.has(a11y) ? prev : new Set(prev).add(a11y)))}
      />
    </View>
  );

  return (
    <ScreenScrollView
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => setLayoutReady(true)}
    >
      <SelectedCalculationTarget target={target} scenario={scenario} identityOnly constraint={targetConstraint} rateConditionContext={rateConditionContext} />
      {target.status !== 'available' && sectionOptions.length > 1 ? (
        <View style={{ marginBottom: 12 }}>
          <SegmentedControl options={sectionOptions} value={section} onChange={changeSection} />
        </View>
      ) : null}

      <PublicPricingCoverage section={section} rows={unpricedRows} scenario={scenario} compact
        pricingSummary={pricedCatalogue.ready ? publicPricing : null} />
      <Card style={{ marginBottom: 16 }}>
        <LocalRateEditor section={section} scenario={scenario} editable={scenarioStorageStatus === 'ready'} onChange={patch => updateScenario(previous => ({ ...previous, localRates: { ...previous.localRates, [scenarioSectionKey]: { ...previous.localRates[scenarioSectionKey], ...patch } } }))}>
          {field('Current rate (%)', (section === 'Mortgage' ? inputs.currentRate : depositInputs.currentRate), currentRate => section === 'Mortgage' ? upd({ currentRate }) : updateScenario(previous => ({ ...previous, [scenarioSectionKey]: { ...previous[scenarioSectionKey], currentRate } })), CALCULATOR_FIELDS.currentRate)}
        </LocalRateEditor>
        <CompactToggle label="Variable rate held" value={scenario.projections[scenarioSectionKey].holdVariableRate} onChange={holdVariableRate => updateScenario(previous => ({ ...previous, projections: { ...previous.projections, [scenarioSectionKey]: { ...previous.projections[scenarioSectionKey], holdVariableRate } } }))} />
        {section === 'Savings' ? <SavingsQualificationEditor inputs={scenario.projections.savings} editable={scenarioStorageStatus === 'ready'} onChange={patch => updateScenario(previous => ({ ...previous, projections: { ...previous.projections, savings: { ...previous.projections.savings, ...patch } } }))} /> : null}
        {isMortgage ? (
          <>
            <View style={{ marginBottom: 10 }}>
              <SegmentedControl<CalcInputs['mode']>
                options={[
                  { label: uiLabel("Buying"), value: 'buy' },
                  { label: uiLabel("Refinancing"), value: 'refi' },
                ]}
                value={inputs.mode}
                onChange={(mode) => upd({ mode })}
              />
            </View>
            {inputs.mode === 'buy' ? (
              <>
                <Row gap={10} style={compactFields ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}>
                  {field('Property price ($)', inputs.propertyValue, (t) => upd({ propertyValue: t }), CALCULATOR_FIELDS.propertyPrice)}
                  {field('Your savings ($)', inputs.deposit, (t) => upd({ deposit: t }), 'Savings available as deposit')}
                </Row>
                <Row gap={10} style={{ marginTop: 10, ...(compactFields ? { flexDirection: 'column', alignItems: 'stretch' } : null) }}>
                  {field('Upfront costs ($)', inputs.costs, (t) => upd({ costs: t }), 'Upfront costs paid from savings')}
                  <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <AppText variant="tiny" color="textFaint" style={{ marginBottom: 4 }}>{uiLabel("Loan needed")}</AppText>
                    <AppText variant="body" weight="800" style={{ paddingVertical: 10 }}>
                      {lvrResult.loan != null ? formatDollars(lvrResult.loan) : uiLabel("—")}
                    </AppText>
                  </View>
                </Row>
              </>
            ) : (
              <Row gap={10} style={compactFields ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}>
                {field('Property value ($)', inputs.propertyValue, (t) => upd({ propertyValue: t }), CALCULATOR_FIELDS.propertyValue)}
                {field('Current loan ($)', inputs.loanBalance, (t) => upd({ loanBalance: t }), CALCULATOR_FIELDS.loanBalance)}
              </Row>
            )}

            {lvr !== null ? (
              <View style={{ marginTop: 12 }}>
                <Row gap={8} style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <AppText variant="small" weight="800">{uiJoin("Scenario LVR",": ",uiNumber(lvr,lvr < 100 ? 1 : 0),"%")}</AppText>
                  {lvrBand ? (
                    <Badge label={uiListedLvr({lvr_tier:lvrBand})} tone="success" />
                  ) : (
                    <AppText variant="tiny" color="textFaint">{uiLabel('Outside tracked LVR bands')}</AppText>
                  )}
                </Row>
                {nextBandHint ? (
                  <Row style={{ justifyContent: 'space-between', marginTop: 4, flexWrap: 'wrap' }}>
                    <AppText variant="tiny" color="textMuted">{uiJoin('Deposit to LVR',' ','≤',uiNumber(nextBandHint.targetPct),'%')}</AppText>
                    <AppText variant="tiny">{formatDollars(nextBandHint.extra)}</AppText>
                  </Row>
                ) : null}
              </View>
            ) : null}

            <Row gap={10} style={{ marginTop: 12, ...(compactFields ? { flexDirection: 'column', alignItems: 'stretch' } : null) }}>
              {field('Years left', inputs.years, (t) => upd({ years: t }), CALCULATOR_FIELDS.years, 86)}
            </Row>
            <View style={{ marginTop: 14 }}>
              <SwitchCostEditor
                inputs={scenario.mortgageSwitch}
                currentDetail={currentProductDetail}
                targetDetail={leadingTargetDetail}
                editable={scenarioStorageStatus === 'ready'}
                compactFields={compactFields}
                onChange={updateSwitch}
              />
            </View>
          </>
        ) : (
          <>
            <AppText variant="small" weight="700" style={{ marginBottom: 10 }}>{uiLabel("Your current balance")}</AppText>
            <Row gap={10} style={compactFields ? { flexDirection: 'column', alignItems: 'stretch' } : undefined}>
              {field(
                section === 'TD' ? 'Deposit amount ($)' : 'Balance ($)',
                depositInputs.balance,
                (balance) => updateScenario((prev) => ({
                  ...prev,
                  [section === 'TD' ? 'termDeposit' : 'savings']: {
                    ...(section === 'TD' ? prev.termDeposit : prev.savings),
                    balance,
                  },
                })),
                CALCULATOR_FIELDS.depositBalance,
              )}
            </Row>
          </>
        )}
        <View style={{ marginTop: 14 }}>
          <CurrentBankPicker
            label={uiLabel(section === 'Mortgage' ? 'Current mortgage bank' : section === 'TD' ? 'Current term deposit bank' : 'Current savings bank')}
            section={section}
            rows={core?.sections?.[section]?.rates ?? []}
            value={currentProduct}
            onChange={updateCurrentProduct}
            editable={scenarioStorageStatus === 'ready'}
          />
        </View>
        {shownInputIssues.length ? (
          <View style={{ marginTop: 12, gap: 4 }}>
            {shownInputIssues.map((issue) => (
              <AppText key={issue} variant="tiny" color="danger">{issue}</AppText>
            ))}
          </View>
        ) : null}
      </Card>

      <AppText variant="small" weight="700" color="textMuted" style={{ marginBottom: 8 }}>
        {inputIssues.length
          ? shownInputIssues.length ? uiLabel("Invalid inputs") : uiLabel("Inputs incomplete")
          : profileFeaturesPending
          ? detailsLoading
            ? uiLabel("Loading")
            : uiLabel("Matches unavailable")
          : target.status === 'available'
            ? uiLabel("Selected rate")
          : candidates.length
            ? isLoan
              ? uiLabel("Lower matched rates")
              : uiLabel("Higher matched rates")
            : currentRate === null
              ? uiLabel("Current rate required")
              : balance <= 0
                ? uiLabel("Loan inputs incomplete")
                : uiLabel("No better comparable rates")}
      </AppText>
      {profileFeaturesPending || targetDetailsMissing ? (
        <Card style={{ marginBottom: 16 }}>
          {detailsLoading || (targetDetailsMissing && !targetDetailsFailed) ? (
            <IndeterminateProgressBar
              caption="Loading"
              accessibilityLabel="Loading"
            />
          ) : (
            <View style={{ gap: 8 }}>
              <AppText variant="small" color="textMuted">{uiLabel("Product details unavailable")}</AppText>
              <Button
                title="Retry"
                variant="secondary"
                onPress={() => targetDetailsMissing ? setTargetDetailsRetry(value=>({key:targetDetailsKey,count:(value?.key===targetDetailsKey?value.count:0)+1})) : void ensureDetails({ force: true, abandonInFlight: true })}
              />
            </View>
          )}
        </Card>
      ) : null}
      {!profileFeaturesPending
        ? candidates.map((c) => {
        const access = assessAccess(
          c.row.product_name,
          details?.products?.[c.row.product_key] ?? null,
          c.row.provider,
        );
        const rateChange = summarizeProductBestRate(
          productHistory,
          c.row.product_key,
          {
            date: core?.run_date,
            rate: bestRateForProduct(core, c.row.product_key),
          },
        );
        const rateDescriptor = section === 'Mortgage'
          ? uiJoin(formatRate(c.projectionRate),' ','Advertised',c.rate !== c.projectionRate ? uiJoin(' · ',formatRate(c.rate),' ','Comparison'):null)
          : uiJoin(formatRate(c.projectionRate),' ',depositRankMetric === 'base' ? 'Ongoing':'Headline');
        return (
          <Pressable
            key={`${c.row.product_key}:${c.row.public_offer_id ?? c.row.rate_index ?? ''}`}
            onPress={c === candidates[0]
              ? openFirstCandidate
              : () => openProduct(c.row.product_key, c.row.rate_index, c.row.public_programme_id)}
            accessibilityRole="button"
            accessibilityLabel={uiJoin('View',' ',uiProviderName(c.row),' · ',uiProductName(c.row),' · ',rateDescriptor)}
          >
            <Card style={{ marginBottom: 10 }}>
              <Row gap={12} style={{ alignItems: 'center' }}>
                <BankAvatar
                  provider={c.row.provider}
                  size={36}
                  renderStateId={`calculator:${c.row.product_key}:${c.row.rate_index ?? 'none'}`}
                  onRenderStateChange={calculatorLogos.onLogoRenderStateChange}
                />
                <View style={{ flex: 1 }}>
                  <AppText variant="body" weight="700" numberOfLines={1}>
                    {uiProviderName(c.row)}
                  </AppText>
                   <AppText variant="tiny" color="textMuted" numberOfLines={1}>
                     {uiJoin(uiProductName(c.row)," · ",rateDescriptor)}
                   </AppText>
                   <ProductRateChangeSummaryLine
                     model={rateChange}
                     section={section}
                     compact
                   />
                  {access.badge ? (
                    <AppText variant="tiny" weight="700" style={{ color: theme.colors.warning, marginTop: 2 }}>
                      {uiAccessBadge(access)}
                    </AppText>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', maxWidth: '42%' }}>
                  {c.unavailableReason ? (
                    <>
                      <AppText variant="body" weight="800">{uiLabel("Rate only")}</AppText>
                      <AppText variant="tiny" color="textFaint" style={{ textAlign: 'right' }}>
                        {targetDetailsMissing ? targetDetailsFailed ? uiLabel("Sources unverified"):uiLabel("Loading") : targetConstraint && targetConstraintContradicted(targetConstraint) ? uiTargetConstraint(targetConstraint) : section === 'TD' && advertisedTermMonths(c.row) == null ? uiLabel("Maturity unpublished") : uiLabel("Eligibility / rate conditions unverified")}
                      </AppText>
                    </>
                  ) : section === 'Mortgage' && c.perMonth != null ? (
                    <>
                      <AppText variant="body" weight="800" style={{ color: c.perMonth < 0 ? theme.colors.danger : theme.colors.success }}>
                        {uiJoin(formatDollars(c.perMonth),' / ','mo')}
                      </AppText>
                      <AppText variant="tiny" color="textFaint" style={{ textAlign: 'right' }}>
                        {c.totalLabel}
                      </AppText>
                    </>
                  ) : c.total != null ? (
                    <>
                      <AppText variant="body" weight="800" style={{ color: c.total < 0 ? theme.colors.danger : theme.colors.success }}>
                        {formatDollars(c.total)}
                      </AppText>
                      <AppText variant="tiny" color="textFaint" style={{ textAlign: 'right' }}>
                        {c.totalLabel}
                      </AppText>
                    </>
                  ) : null}
                </View>
                <AppText variant="body" color="textFaint" style={{ marginLeft: 2 }}>
                  {uiLabel('→')}
                </AppText>
              </Row>
            </Card>
          </Pressable>
        );
      })
        : null}

      <Card style={{ gap: 8 }}>
        <AppText variant="tiny" color="textMuted">{uiLabel("Illustrative")}</AppText>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <AppText variant="tiny" color="textMuted">{uiLabel("Excluded")}</AppText>
          <AppText variant="tiny">{uiLabel("Fees · Tax · Switching costs")}</AppText>
        </Row>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <AppText variant="tiny" color="textMuted">{uiLabel("Conditions")}</AppText>
          <AppText variant="tiny">{uiLabel("Unverified")}</AppText>
        </Row>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <AppText variant="tiny" color="textMuted">{uiLabel("Difference basis")}</AppText>
          <AppText variant="tiny">{isMortgage ? uiLabel("Initial repayment") : section === 'TD' ? uiLabel("Published maturity · Non-conditional rate") : uiLabel("Simple annual interest · Non-conditional rate")}</AppText>
        </Row>
        {isMortgage ? <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <AppText variant="tiny" color="textMuted">{uiLabel("Fixed-rate scope")}</AppText>
          <AppText variant="tiny">{uiLabel("Published period")}</AppText>
        </Row> : <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <AppText variant="tiny" color="textMuted">{uiLabel("Compounding")}</AppText>
          <AppText variant="tiny">{uiLabel("Excluded")}</AppText>
        </Row>}
      </Card>
      {target.status === 'available' ? <PublicCostComparison section={section} target={target.row} scenario={calculationScenario} /> : null}
      <Card style={{ marginBottom: 16, gap: 10 }}>
        <Button
          title="Projection"
          icon="analytics-outline"
          onPress={() => void openProjections()}
          disabled={scenarioStorageStatus !== 'ready'}
        />
        {scenarioStorageStatus === 'loading' || scenarioStorageStatus === 'idle' ? (
          <AppText variant="tiny" color="textMuted">{uiLabel("Loading")}</AppText>
        ) : null}
        {scenarioSaveStatus === 'saving' || scenarioSaveStatus === 'saved' ? (
          <AppText variant="tiny" color="textMuted">
            {uiLabel(scenarioSaveStatus === 'saving' ? 'Saving' : 'Saved')}
          </AppText>
        ) : null}
        {scenarioError ? (
          <>
            <AppText variant="tiny" color="danger">{uiLabel("Scenario unavailable")}</AppText>
            {scenarioStorageStatus === 'error' ? (
              <Button title="Retry encrypted storage" variant="secondary" onPress={() => void retryScenarioLoad()} />
            ) : null}
          </>
        ) : null}
      </Card>

      {isMortgage ? (
        <View style={{ marginBottom: 16 }}>
          <Disclosure
            title="Profile needs"
            open={assumptionsOpen}
            onToggle={() => setAssumptionsOpen((open) => !open)}
          >
            <ProfileEditor
              sections={['Mortgage']}
              value={profileFilters}
              onChange={(next) => setPref('profileFilters', next)}
            />
          </Disclosure>
        </View>
      ) : null}

      <Button title="Calculation receipt" variant="secondary" onPress={() => router.push('/calculation-receipt')} />
    </ScreenScrollView>
  );
}
