import { ActivityPeriodCalculation } from '../../src/components/product/ActivityPeriodCalculation';
import { MortgagePeriodCalculation } from '../../src/components/product/MortgagePeriodCalculation';
import { SavingsPeriodCalculation } from '../../src/components/product/SavingsPeriodCalculation';
import { EligibilityAssessment } from '../../src/components/product/EligibilityAssessment';
import { DetailsOnlyProduct } from '../../src/components/product/DetailsOnlyProduct';
import { FixedDepositCalculation } from '../../src/components/product/FixedDepositCalculation';
import { ProductTermsDisclosure } from '../../src/components/product/ProductTermsDisclosure';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HeaderTitle } from '@react-navigation/elements';
import {
  InteractionManager,
  Share,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { BankAvatar } from '../../src/components/BankAvatar';
import { NavigationMenuButton } from '../../src/components/AppNavigationMenu';
import {
  BankHistoryChart,
  type BankHistoryChartAuditActions,
} from '../../src/components/BankHistoryChart';
import { ChartErrorBoundary } from '../../src/components/ChartErrorBoundary';
import { EmptyState } from '../../src/components/feedback';
import { ProductRateChangeLine } from '../../src/components/product/ProductRateChangeLine';
import {
  AccessNotice,
  DetailGroup,
  HistoryLegend,
  OfficialLinks,
  ProductFacts,
  ProductRatesList,
  ProductSpecs,
  SectionTitle,
  SelectedRateConditions,
} from '../../src/components/product/ProductDetailParts';
import { ScreenScrollView } from '../../src/components/Screen';
import { AppText, Button, Card, IconButton, Row } from '../../src/components/ui';
import { SECTIONS } from '../../src/constants';
import { filterBankInsightsForSuitability } from '../../src/data/bankInsights';
import { uiDate, uiJoin, uiLabel, uiProductName, uiProviderName, uiSectionName } from '../../src/lib/uiCopy';
import { selectedTargetConstraint, targetConstraintContradicted } from '../../src/lib/selectedTargetConstraints';
import { uiTargetConstraint } from '../../src/lib/financialUiCopy';
import { formatRate, isNonStandard, toFraction } from '../../src/data/format';
import { normalizedProductFacts } from '../../src/data/productFacts';
import { verifiedDetailsSha } from '../../src/data/detailsIdentity';
import { isMandatoryEligibilityReady, mandatoryProductAllowed } from '../../src/data/eligibilityGate';
import { sortRows, findEligibleByKey } from '../../src/data/selectors';
import { selectBankHistoryChartModel } from '../../src/data/historySelectors';
import { mergeProductHistoryTimeline, rateHistoryChartModel } from '../../src/data/rateHistoryCharts';
import {
  countFiniteSeriesPoints,
  productSeriesRecordForChart,
  productSeriesRecordWithCurrent,
} from '../../src/data/productHistory';
import { useStore } from '../../src/data/store';
import { isSavedRate } from '../../src/data/savedRates';
import { usePerformanceAuditSurface } from '../../src/hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../../src/hooks/useLogoReadiness';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import { useBankRateHistory } from '../../src/hooks/useBankRateHistory';
import { useUserRateScenario } from '../../src/hooks/useUserRateScenario';
import { StaySwitchChart } from '../../src/components/scenario/StaySwitchChart';
import { buildStaySwitchProjection } from '../../src/data/staySwitchProjection';
import { NOT_LISTED_PROVIDER } from '../../src/data/userRateScenario';
import { openBank, openRateReceipt } from '../../src/lib/nav';
import { buildCalculationRoute } from '../../src/lib/calculationTarget';
import { rateQualifier } from '../../src/lib/rateQualifier';
import { buildRateReceipt, rateReceiptShareText } from '../../src/data/rateReceipt';
import { logSwallowedError } from '../../src/lib/degradationLog';
import {
  effectiveBankInsights,
  effectiveHistoryRibbon,
} from '../../src/lib/proAccess';
import { yieldToUi } from '../../src/lib/yieldToUi';
import {
  auditActionString,
} from '../../src/lib/performanceAuditActionParams';
import { ratePresentation } from '../../src/data/ratePresentation';
import { useTheme } from '../../src/theme/ThemeProvider';
import { HEADER_TYPOGRAPHY } from '../../src/theme/typography';
import {
  isCurrentHistoryGraphicEvidence,
  type HistoryGraphicEvidence,
} from '../../src/lib/historyGraphicEvidence';

/** Back button plus title margins in the JS stack header. */
const HEADER_BACK_RESERVE = 72;
/** Below this width the labelled Menu button leaves too little room for the title. */
const COMPACT_HEADER_WIDTH = 400;

const MemoProductSpecs = React.memo(ProductSpecs);
const MemoProductFacts = React.memo(ProductFacts);
const MemoSelectedRateConditions = React.memo(SelectedRateConditions);
const MemoProductRatesList = React.memo(ProductRatesList);
const MemoEligibilityAssessment = React.memo(EligibilityAssessment);
const MemoFixedDepositCalculation = React.memo(FixedDepositCalculation);
const MemoSavingsPeriodCalculation = React.memo(SavingsPeriodCalculation);
const MemoActivityPeriodCalculation = React.memo(ActivityPeriodCalculation);
const MemoMortgagePeriodCalculation = React.memo(MortgagePeriodCalculation);

export default function ProductDetail() {
  const suitabilityRevision = useSuitabilityRevision();
  const theme = useTheme();
  const { key, ri } = useLocalSearchParams<{ key: string; ri?: string }>();
  const productKey = key ?? '';
  const exactRateRequested = ri != null && ri !== '';
  const parsedRateIndex = exactRateRequested ? Number(ri) : null;
  const rateIndex = parsedRateIndex != null && Number.isInteger(parsedRateIndex) ? parsedRateIndex : null;
  const core = useStore((s) => s.core);
  const found = useMemo(
    () => {
      void suitabilityRevision;
      return core ? findEligibleByKey(core.sections, productKey) : null;
    },
    [core, productKey, suitabilityRevision],
  );
  const coreIntegrity = useStore((s) => s.coreIntegrity);
  const rateConditionManifest = useStore(s => s.manifest);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256);
  const detailsSha = useStore((s) => s.manifest?.files.details.sha256);
  const historyBanksSha = useStore((s) => s.manifest?.files.history_banks?.sha256 ?? null);
  const bankInsightsSha = useStore((s) => s.manifest?.files.bank_history?.sha256 ?? null);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const detailsPayload = useStore((s) => s.details);
  const detail = detailsPayload?.products[productKey] ?? null;
  const normalizedFactKinds = useMemo(
    () => new Set(normalizedProductFacts(detail).map((fact) => fact.kind)),
    [detail],
  );
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const detailsLoading = useStore((s) => s.detailsLoading);
  const detailsRequestIdentity = `${core?.run_date ?? ''}|${coreSha ?? ''}|${detailsSha ?? ''}|${productKey}`;
  const [settledDetailsRequest, setSettledDetailsRequest] = useState<string | null>(null);
  const savedRates = useStore((s) => s.savedRates);
  const toggleSavedRate = useStore((s) => s.toggleSavedRate);
  const setPref = useStore((s) => s.setPref);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const historyEnabled = useStore((s) => effectiveHistoryRibbon(s.prefs));
  const rateHistory = useBankRateHistory(historyEnabled && !!found);
  const showBankInsights = effectiveBankInsights();
  const historyBanks = useStore((s) => s.historyBanks);
  const bankInsights = useStore((s) => s.bankInsights);
  const bankInsightsError = useStore((s) => s.bankInsightsError);
  const productHistory = useStore((s) => s.productHistory);
  const ledgerRevision = useRef({ payload: productHistory, version: 0 });
  if (ledgerRevision.current.payload !== productHistory) {
    ledgerRevision.current = { payload: productHistory, version: ledgerRevision.current.version + 1 };
  }
  const productHistoryError = useStore((s) => s.productHistoryError);
  const ensureHistoryBanks = useStore((s) => s.ensureHistoryBanks);
  const ensureBankInsights = useStore((s) => s.ensureBankInsights);
  const ensureProductHistory = useStore((s) => s.ensureProductHistory);
  const insightsRequestKey = useRef<string | null>(null);
  const historyAuditActionsRef = useRef<BankHistoryChartAuditActions | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const { width: windowWidth } = useWindowDimensions();
  const [headerActionsWidth, setHeaderActionsWidth] = useState(0);
  const [historyGraphicEvidence, setHistoryGraphicEvidence] =
    useState<HistoryGraphicEvidence | null>(null);
  const { scenario } = useUserRateScenario();

  useEffect(() => {
    let current = true;
    const settled = () => { if (current) setSettledDetailsRequest(detailsRequestIdentity); };
    void ensureDetails({ forProductView: true }).then(settled, (error) => {
      logSwallowedError('product.ensureDetails', error);
      settled();
    });
    return () => { current = false; };
  }, [ensureDetails, detailsRequestIdentity]);

  useEffect(() => {
    if (!showBankInsights || !found) {
      insightsRequestKey.current = null;
      return;
    }
    const key = core?.run_date ?? null;
    if (!key || insightsRequestKey.current === key) return;
    insightsRequestKey.current = key;
    void ensureBankInsights();
  }, [core?.run_date, ensureBankInsights, showBankInsights, found]);

  useEffect(() => {
    if (!historyEnabled || !found) return;
    // Product-history dated-core fan-out is expensive; wait until the product
    // screen transition finishes so navigation stays instant (including during
    // performance audit — eager sync was starving browse/search journeys).
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      void yieldToUi().then(() => {
        if (cancelled) return;
        void ensureHistoryBanks().then(() => {
          if (cancelled) return;
          if (showBankInsights) void ensureBankInsights();
          void ensureProductHistory();
        });
      });
    });
    return () => {
      cancelled = true;
      handle.cancel?.();
    };
  }, [
    core?.run_date,
    coreSha,
    historyEnabled,
    showBankInsights,
    ensureHistoryBanks,
    ensureBankInsights,
    ensureProductHistory,
    found,
    productKey,
  ]);

  const row = found
    ? exactRateRequested
      ? rateIndex == null
        ? null
        : found.siblings.find((candidate) => candidate.rate_index === rateIndex) ?? null
      : found.row
    : null;
  const rateRows = useMemo(() => found
    ? sortRows(found.siblings, 'rate', found.section, depositRankMetric, mortgageRateMetric)
    : [], [found, depositRankMetric, mortgageRateMetric]);
  // Product history is explicitly product-wide: preserve the section-best
  // headline across every eligible sibling, independently of the selected tier.
  const currentBest = useMemo(() => {
    let best: number | null = null;
    for (const sibling of found?.siblings ?? []) {
      const rate = toFraction(sibling.rate);
      if (rate == null || rate <= 0) continue;
      best = best == null ? rate : found?.section === 'Mortgage' ? Math.min(best, rate) : Math.max(best, rate);
    }
    return best;
  }, [found]);
  const auditProductError = core && isMandatoryEligibilityReady() && !row
    ? !mandatoryProductAllowed(productKey)
      ? 'The selected product does not meet the current mandatory profile requirements'
      : 'The selected exact rate is absent from the eligible current catalogue'
    : null;
  const staySwitchProjection = useMemo(() => {
    if (!row || found?.section !== 'Mortgage' || !detail || !detailsProducts) return null;
    if (targetConstraintContradicted(selectedTargetConstraint(row, 'Mortgage', scenario,
      { core, details: detailsPayload, manifest: rateConditionManifest, coreIntegrity }))) return null;
    const currentRef = scenario.currentProducts.mortgage;
    return buildStaySwitchProjection({
      scenario,
      target: row,
      currentDetail: currentRef.productKey && mandatoryProductAllowed(currentRef.productKey) ? detailsProducts[currentRef.productKey] : null,
      targetDetail: detail,
    });
  }, [detail, detailsProducts, found?.section, row, scenario, core, detailsPayload, rateConditionManifest, coreIntegrity]);
  const currentBankLabel = (!scenario.currentProducts.mortgage.productKey || mandatoryProductAllowed(scenario.currentProducts.mortgage.productKey)) && scenario.currentProducts.mortgage.provider
    && scenario.currentProducts.mortgage.provider !== NOT_LISTED_PROVIDER
    ? scenario.currentProducts.mortgage.provider
    : 'Current bank';

  const explorerInsights = useMemo(() => {
    void suitabilityRevision;
    return filterBankInsightsForSuitability(
      bankInsights,
      core,
      includeNonStandard,
      detailsProducts,
      suitabilityRevision,
      coreIntegrity,
    );
  }, [bankInsights, core, coreIntegrity, detailsProducts, includeNonStandard, suitabilityRevision]);

  const marketHistoryModel = useMemo(() => {
    void suitabilityRevision;
    if (!historyEnabled || !core || !found) return null;
    if (rateHistory.updating || rateHistory.failed) return null;
    const detailed = rateHistory.historyAvailable ? rateHistoryChartModel(rateHistory.snapshots, found.section) : null;
    if (rateHistory.historyAvailable || rateHistory.richHistory) return detailed;
    return selectBankHistoryChartModel(
      {
        core,
        coreIntegrity,
        historyBanks,
        bankInsights: explorerInsights,
        includeNonStandard,
        detailsProducts,
      },
      found.section,
      'All',
    );
  }, [
    core,
    coreIntegrity,
    detailsProducts,
    explorerInsights,
    found,
    historyBanks,
    historyEnabled,
    includeNonStandard,
    suitabilityRevision,
    rateHistory.snapshots,
    rateHistory.historyAvailable,
    rateHistory.richHistory,
    rateHistory.updating,
    rateHistory.failed,
  ]);
  const historyModel = useMemo(() => !historyEnabled || !found ? null : mergeProductHistoryTimeline(
    marketHistoryModel, found.section, productHistory?.run_dates, core?.run_date,
  ), [marketHistoryModel, found, historyEnabled, productHistory, core?.run_date]);
  const seededProductValues = useMemo(() => productSeriesRecordWithCurrent(
    productHistory, productKey, core?.run_date, currentBest,
  ), [productHistory, productKey, core?.run_date, currentBest]);
  const productSeries = useMemo(() => ({
    values: productSeriesRecordForChart(productHistory, productKey,
      historyModel?.allDates ?? historyModel?.dates ?? [], core?.run_date, currentBest),
    label: row ? uiProductName(row) : uiLabel('Product'),
    valueScope: uiJoin('Leading advertised', ' · ', 'All tiers'),
    color: theme.ledger.info,
  }), [productHistory, productKey, historyModel, core?.run_date, currentBest, row, theme.ledger.info]);

  // Single-day fallback is a misleading solid RBA block; wait for multi-day context
  // when Standard-only mode is relying on bank insights that have not arrived yet.
  // Stop waiting once insights fail so the empty/collecting copy can show.
  const historyWaitingForInsights =
    historyEnabled &&
    !rateHistory.historyAvailable &&
    !rateHistory.updating &&
    !rateHistory.failed &&
    !includeNonStandard &&
    showBankInsights &&
    !explorerInsights &&
    !bankInsightsError &&
    (!historyModel || historyModel.dates.length < 2);
  const historyContentRevision = [
    rateHistory.revision,
    ledgerRevision.current.version,
    coreSha ?? core?.run_date ?? 'no-core',
    historyBanksSha ?? 'no-history-banks',
    bankInsightsSha ?? 'no-bank-history',
    productHistory?.core_sha ?? 'no-product-history-core',
    productHistory?.run_dates.at(-1) ?? 'no-product-history-date',
    productHistory?.run_dates.length ?? 0,
    productKey,
    historyModel?.dates.at(-1) ?? 'none',
    historyModel?.dates.length ?? 0,
  ].join(':');
  const openCalculate = useCallback(() => {
    const selectedSection = found?.section;
    if (!row || !selectedSection) return { unavailableReason: 'Selected product has no eligible rate' };
    router.push(buildCalculationRoute(row, selectedSection));
    return { expectedPath: '/calculator' };
  }, [row, found?.section]);
  const auditActions = useMemo(() => {
    const actions: Record<string, (...args: unknown[]) => unknown> = {
      'product.open': () => undefined,
      'product.calculate.open': openCalculate,
      'product.receipt.open': () => {
        if (row) openRateReceipt(productKey, row.rate_index);
      },
      'product.lender.open': (...args: unknown[]) => {
        const provider = auditActionString(args, 'provider') || row?.provider || null;
        if (!provider) {
          return { unavailableReason: 'The mounted product has no lender provider to open' };
        }
        openBank(provider);
        return { expectedPath: `/bank/${encodeURIComponent(provider)}` };
      },
      'calculator.candidate.back': () => router.back(),
      'product.history.window.30d': () => {
        if (!historyAuditActionsRef.current) {
          return { unavailableReason: 'The mounted product has no rendered history window control' };
        }
        if (historyGraphicEvidence?.window !== '30D') setHistoryGraphicEvidence(null);
        historyAuditActionsRef.current.select30DayWindow();
      },
      'product.history.date.previous': () => historyAuditActionsRef.current
        ? historyAuditActionsRef.current.selectPreviousDate()
        : { unavailableReason: 'The mounted product has no multi-date history chart' },
    };
    return actions;
  }, [historyGraphicEvidence?.window, productKey, row, openCalculate]);
  const productLogoIds = useMemo(
    () => row ? [`product:${row.rate_index ?? 'default'}#${row.product_key}`] : [],
    [row],
  );
  const logoReadiness = useLogoReadiness(productLogoIds.join('|'), productLogoIds);
  const currentHistoryGraphicEvidence = isCurrentHistoryGraphicEvidence(
    historyGraphicEvidence,
    historyContentRevision,
  ) ? historyGraphicEvidence : null;
  const productRenderRevision = `${productKey}:${row?.rate_index ?? 'none'}:${detailsLoading ? 'loading' : 'settled'}:${historyContentRevision}:${currentHistoryGraphicEvidence?.graphicRevision ?? 'graphic-pending'}`;
  const detailsRequestSettled = settledDetailsRequest === detailsRequestIdentity && !detailsLoading;
  const auditDetailsError = !detailsRequestSettled ? null
    : !core || !detailsSha || detailsPayload?.run_date !== core.run_date ||
        verifiedDetailsSha(detailsPayload) !== detailsSha
      ? 'Product details are unavailable for the active rates publication after loading finished'
      : !detail ? 'The selected product is absent from the verified details payload' : null;
  const onHistoryGraphicReady = React.useCallback((evidence: HistoryGraphicEvidence) => {
    setHistoryGraphicEvidence((current) => {
      return current?.graphicRevision === evidence.graphicRevision &&
        current.availability === evidence.availability &&
        current.pointCount === evidence.pointCount &&
        current.accessibleSummary === evidence.accessibleSummary &&
        current.layoutMeasured === evidence.layoutMeasured &&
        current.emptyStateRendered === evidence.emptyStateRendered &&
        current.expectedCount === evidence.expectedCount
        ? current
        : evidence;
    });
  }, []);
  usePerformanceAuditSurface({
    id: 'product.details',
    routeKey: '/product/[key]',
    datasetRevision: core?.run_date ?? null,
    renderRevision: productRenderRevision,
    actions: auditActions,
    probes: [
      {
        id: 'product.data',
        kind: 'data',
        status: auditProductError ? 'error' : core && row ? 'ready' : 'pending',
        error: auditProductError,
        datasetRevision: core?.run_date ?? null,
      },
      {
        id: 'product.details-data',
        kind: 'data',
        status: !detailsRequestSettled ? 'pending' : auditDetailsError ? 'error' : 'ready',
        error: auditDetailsError,
        datasetRevision: core?.run_date ?? null,
      },
      {
        id: 'product.rate-tiers',
        kind: 'list',
        status: found ? 'ready' : 'pending',
        expectedCount: found?.siblings.length ?? 0,
        actualCount: found?.siblings.length ?? 0,
      },
      {
        id: 'product.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
        renderRevision: productRenderRevision,
      },
      {
        id: 'product.logo',
        kind: 'logo',
        status: row && logoReadiness.ready ? 'ready' : 'pending',
        expectedCount: logoReadiness.expectedCount,
        actualCount: logoReadiness.terminalCount,
        fallbackCount: logoReadiness.fallbackCount,
      },
      {
        id: 'product.history-graphic',
        kind: 'graphic',
        required: false,
        status: rateHistory.failed ? 'error' : historyWaitingForInsights || rateHistory.updating
          ? 'pending'
          : !historyModel
            ? 'ready'
            : !currentHistoryGraphicEvidence
              ? 'pending'
              : currentHistoryGraphicEvidence.availability === 'rendered'
                ? 'ready'
                : 'error',
        error: rateHistory.failed ? 'Market history could not be prepared'
          : !historyWaitingForInsights && currentHistoryGraphicEvidence?.availability === 'unavailable'
          ? 'Product history has no finite values to plot'
          : null,
        expectedCount: currentHistoryGraphicEvidence?.expectedCount ?? 0,
        actualCount: currentHistoryGraphicEvidence?.pointCount ?? 0,
        accessibleSummary: currentHistoryGraphicEvidence?.accessibleSummary ?? false,
        layoutMeasured: currentHistoryGraphicEvidence?.layoutMeasured ?? false,
        emptyStateRendered: currentHistoryGraphicEvidence?.emptyStateRendered ?? false,
      },
      {
        id: 'product.history-data',
        kind: 'data',
        // History sync is deferred after paint; do not block product readiness on it.
        required: false,
        status: !historyEnabled || productHistory
          ? 'ready'
          : productHistoryError
            ? 'error'
            : 'pending',
        error: historyEnabled ? productHistoryError : null,
        expectedCount: historyEnabled ? 1 : 0,
        actualCount: historyEnabled && productHistory ? 1 : 0,
      },
    ],
  });

  if (!isMandatoryEligibilityReady() || !mandatoryProductAllowed(productKey)) {
    return <><Stack.Screen options={{ title: 'Product unavailable' }} /><EmptyState icon="alert-circle-outline" title={!isMandatoryEligibilityReady() ? 'Loading' : 'Unavailable'} /></>;
  }
  if (!found) {
    if (exactRateRequested) return <><Stack.Screen options={{ title: 'Product rate unavailable' }} /><EmptyState icon="alert-circle-outline" title="Exact rate no longer available" /></>;
    return <DetailsOnlyProduct productKey={productKey} />;
  }

  const { section } = found;
  if (!row) {
    return (
      <>
        <Stack.Screen options={{ title: 'Product rate unavailable' }} />
        <EmptyState
          icon="alert-circle-outline"
          title="Exact rate no longer available"
          fill
        />
      </>
    );
  }
  const exactSaveEligible = row.exact_alert_eligible !== false && Number.isInteger(row.rate_index);
  const saveScope = exactSaveEligible ? 'rate' : 'product';
  const favorite = isSavedRate(savedRates, productKey, exactSaveEligible ? row.rate_index! : null);
  const productWideSaved = savedRates.some(
    (ref) => ref.scope === 'product' && ref.productKey === productKey,
  );
  const meta = SECTIONS[section];
  const qualifier = rateQualifier(row, section);
  const presentation = ratePresentation(row, section, mortgageRateMetric);

  const sectionInk = meta.lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit;
  // Distinct from the market ribbon ink (clay/eucalyptus) and the RBA line (wattle)
  // in both appearances; `warning` matched clay in light and wattle in dark.
  const productInk = theme.ledger.info;
  const observedProductPoints = countFiniteSeriesPoints(seededProductValues);
  const productHasHighlight = observedProductPoints > 0;
  const selectedHistoryContext = uiJoin('Selected rate', ' ', formatRate(row.rate), ' · ', 'Leading advertised', ' ', formatRate(currentBest), ' · ', 'All tiers');

  const onShare = () =>
    Share.share({
      message: rateReceiptShareText(buildRateReceipt({ row, section, evidenceDate: core?.run_date ?? '', detail,
        rateConditionContext: { core, details: detailsPayload, manifest: rateConditionManifest, coreIntegrity } })),
    }).catch((err) => logSwallowedError('product.share', err));

  return (
    <>
      <Stack.Screen
        options={{
          title: uiProviderName(row),
          // The JS header (used with breadcrumbs) reserves ~52 dp for headerRight;
          // these actions are wider, so cap the title to the space left beside them.
          headerTitleAlign: 'left',
          headerTitle: ({ style, allowFontScaling, onLayout }: {
            tintColor?: string;
            style?: StyleProp<TextStyle>;
            allowFontScaling?: boolean;
            onLayout?: (event: LayoutChangeEvent) => void;
          }) => (
            <HeaderTitle
              allowFontScaling={allowFontScaling}
              onLayout={onLayout}
              style={[
                style ?? { color: theme.colors.text, ...HEADER_TYPOGRAPHY },
                headerActionsWidth
                  // No floor: on the narrowest phones the title ellipsises rather than overlap.
                  ? { maxWidth: Math.max(0, windowWidth - HEADER_BACK_RESERVE - headerActionsWidth) }
                  : null,
              ]}
            >
              {uiProductName(row)}
            </HeaderTitle>
          ),
          headerRight: () => (
            <Row
              gap={2}
              onLayout={(e) => {
                const next = Math.ceil(e.nativeEvent.layout.width);
                setHeaderActionsWidth((current) => (current === next ? current : next));
              }}
            >
              <IconButton icon="share-outline" onPress={onShare} accessibilityLabel="Share" />
              <NavigationMenuButton compact={windowWidth < COMPACT_HEADER_WIDTH} />
            </Row>
          ),
        }}
      />
      <ScreenScrollView
        onLayout={() => setLayoutReady(true)}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <Row gap={14} style={{ marginBottom: 16 }}>
          <BankAvatar
            provider={row.provider}
            size={40}
            renderStateId={productLogoIds[0]}
            onRenderStateChange={logoReadiness.onLogoRenderStateChange}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">{uiProductName(row)}</AppText>
            <AppText variant="small" color="textMuted">
              {uiJoin(uiProviderName(row), ' · ', uiSectionName(section))}
            </AppText>
          </View>
        </Row>

        <View style={{ marginBottom: 16, gap: 4 }}>
          <AppText variant="small" color="textMuted">
            {presentation.primaryLabel}
          </AppText>
          <AppText variant="rateHero" weight="700" style={{ color: theme.colors.text }}>
            {formatRate(presentation.primary)}
          </AppText>
          {presentation.secondary !== null && presentation.secondaryLabel ? (
            <AppText variant="small" color="textFaint">
              {uiJoin(formatRate(presentation.secondary), ' ', presentation.secondaryLabel)}
            </AppText>
          ) : null}
          <ProductRateChangeLine
            productKey={productKey}
            section={section}
            current={{ date: core?.run_date, rate: currentBest }}
          />
          <AppText variant="tiny" color="textFaint" style={{ marginTop: 6 }}>
            {uiJoin('Checked', ' ', uiDate(core?.run_date))}
          </AppText>
          {isNonStandard(row) ? (
            <View
              style={{
                marginTop: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: theme.radius.sm,
                backgroundColor: theme.colors.chip,
              }}
            >
              <AppText variant="tiny" weight="700" style={{ color: theme.colors.warning }}>
                {uiLabel("Non-standard")}</AppText>
            </View>
          ) : null}
          {qualifier.conditional ? (
            <>
              <View
                style={{
                  marginTop: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: theme.radius.sm,
                  borderWidth: 1,
                  borderColor: theme.colors.warning,
                }}
              >
                <AppText variant="tiny" weight="700" style={{ color: theme.colors.warning }}>
                  {qualifier.label}
                </AppText>
              </View>
            </>
          ) : null}
        </View>

        <Row gap={12} style={{ marginBottom: 16 }}>
          <Button
            title={favorite ? 'Saved' : 'Save'}
            icon={favorite ? 'star' : 'star-outline'}
            style={{ flex: 1 }}
            accessibilityState={{ selected: favorite }}
            onPress={() => toggleSavedRate(row, saveScope)}
          />
          <Button
            title="Calculate"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={openCalculate}
          />
        </Row>

        {staySwitchProjection?.ready ? (
          <View style={{ marginBottom: 16 }}>
            <StaySwitchChart
              projection={staySwitchProjection}
              currentBank={currentBankLabel}
              compact
              onOpenFull={() => router.push(buildCalculationRoute(row, section, 'project'))}
            />
          </View>
        ) : null}

        <AccessNotice name={row.product_name} provider={row.provider} productDetails={detail} loading={detailsLoading} />
        <AppText variant="small" color="textMuted">{uiTargetConstraint(selectedTargetConstraint(row, section, scenario,
          { core, details: detailsPayload, manifest: rateConditionManifest, coreIntegrity }))}</AppText>

        <MemoProductSpecs row={row} section={section} productDetails={detail} />

        <Button
          title="Bank-call brief"
          icon="receipt-outline"
          variant="secondary"
          style={{ marginBottom: 16 }}
          onPress={() => openRateReceipt(productKey, row.rate_index)}
        />

        <SectionTitle text="Published product history" icon="trending-up-outline" />
        <Card style={{ marginBottom: 16 }}>
          <AppText variant="tiny" color="textFaint" style={{ marginBottom: 8 }}>
            {uiJoin('Leading advertised', ' · ', 'All tiers')}
          </AppText>
          {selectedHistoryContext ? (
            <AppText variant="tiny" color="textMuted" style={{ marginBottom: 8 }}>
              {selectedHistoryContext}
            </AppText>
          ) : null}
          {historyEnabled ? (
            !rateHistory.failed && (historyWaitingForInsights || rateHistory.updating) && (!historyModel || historyModel.dates.length < 2) ? (
              <AppText variant="small" color="textMuted">
                {uiLabel("Loading")}</AppText>
            ) : historyModel && historyModel.dates.length >= 2 ? (
              <>
                <AppText variant="tiny" color="textFaint" style={{ marginBottom: 8 }}>
                  {uiJoin(uiProductName(row), ' · ', uiSectionName(section), ' · ', 'Matching rates')}
                </AppText>
                <ChartErrorBoundary name="ProductHistoryChart">
                  <BankHistoryChart
                    auditActionsRef={historyAuditActionsRef}
                    contentRevision={historyContentRevision}
                    dates={historyModel.dates}
                    points={historyModel.points}
                    allDates={historyModel.allDates}
                    rba={core?.rba}
                    rbaHolds={core?.rba_holds}
                    section={section}
                    height={210}
                    highlightSeries={productHasHighlight ? productSeries : null}
                    onGraphicReady={onHistoryGraphicReady}
                  />
                </ChartErrorBoundary>
                <HistoryLegend productColor={productInk} sectionColor={sectionInk} />
                {rateHistory.updating || rateHistory.failed || rateHistory.missingDates.length ? (
                  <AppText variant="tiny" color="textMuted" style={{ marginTop: 6 }}>
                    {uiLabel(rateHistory.failed ? 'Unavailable' : rateHistory.updating ? 'Loading' : 'Missing details')}
                  </AppText>
                ) : null}
                {productHistoryError && observedProductPoints < 2 ? (
                  <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                    <AppText variant="tiny" color="danger" style={{ flex: 1 }}>
                      {uiLabel("History unavailable")}</AppText>
                    <Button
                      title="Retry"
                      variant="ghost"
                      onPress={() => void ensureProductHistory({ force: true })}
                    />
                  </Row>
                ) : observedProductPoints < 2 ? (
                  <AppText variant="tiny" color="textFaint" style={{ marginTop: 6 }}>
                    {uiJoin('Leading advertised', ' ', formatRate(currentBest), ' · ', 'All tiers')}
                  </AppText>
                ) : null}
              </>
            ) : (
              <AppText variant="small" color="textMuted">
                {uiLabel(rateHistory.failed ? 'History unavailable' : 'No observations')}
              </AppText>
            )
          ) : (
            <>
              <Button
                title="Show market history"
                icon="analytics-outline"
                variant="secondary"
                onPress={() => setPref('showHistoryRibbon', true)}
              />
            </>
          )}
        </Card>

        <MemoProductFacts productDetails={detail} />
        <MemoSelectedRateConditions row={row} section={section} />
        {section === 'TD' ? <MemoFixedDepositCalculation row={row} /> : null}
        <MemoEligibilityAssessment productKey={productKey} row={row} section={section} /><MemoSavingsPeriodCalculation productKey={row.product_key} row={row} section={section} /><MemoActivityPeriodCalculation productKey={row.product_key} row={row} section={section} /><MemoMortgagePeriodCalculation productKey={row.product_key} row={row} section={section} />
        <DetailGroup title="Features" icon="checkmark-circle-outline" items={normalizedFactKinds.has('feature') ? undefined : detail?.features} loading={detailsLoading && !normalizedFactKinds.has('feature')} />
        <DetailGroup title="Fees" icon="cash-outline" items={detail?.fees} loading={detailsLoading} />
        <DetailGroup title="Eligibility" icon="person-outline" items={normalizedFactKinds.has('eligibility') ? undefined : detail?.eligibility} loading={detailsLoading && !normalizedFactKinds.has('eligibility')} />
        <DetailGroup title="Constraints" icon="lock-closed-outline" items={normalizedFactKinds.has('constraint') ? undefined : detail?.constraints} loading={detailsLoading && !normalizedFactKinds.has('constraint')} />

        <OfficialLinks links={detail?.links} sourceDocuments={detail?.sourceDocuments} />
        <ProductTermsDisclosure productKey={productKey} />

        <Button
          title={uiJoin('View', ' ', uiProviderName(row), ' ', 'Products')}
          icon="business-outline"
          variant="secondary"
          style={{ marginTop: 4 }}
          onPress={() => openBank(row.provider)}
        />

        <MemoProductRatesList rows={rateRows} section={section} accent={theme.colors.primary} />

        {exactSaveEligible ? <Button
          title={productWideSaved ? 'Remove all rates' : 'Save all rates'}
          icon={productWideSaved ? 'star' : 'star-outline'}
          variant="ghost"
          style={{ marginBottom: 16 }}
          onPress={() => toggleSavedRate(row, 'product')}
        /> : null}

        {row.last_updated ? (
          <AppText variant="tiny" color="textFaint" style={{ textAlign: 'center', marginTop: 14 }}>
            {uiJoin('Source date', ' ', uiDate(row.last_updated))}
          </AppText>
        ) : null}
      </ScreenScrollView>
    </>
  );
}
