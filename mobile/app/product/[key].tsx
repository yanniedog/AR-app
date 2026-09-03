import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, InteractionManager, Share, View } from 'react-native';

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
} from '../../src/components/product/ProductDetailParts';
import { ScreenScrollView } from '../../src/components/Screen';
import { AppText, Button, Card, IconButton, Row } from '../../src/components/ui';
import { SECTIONS } from '../../src/constants';
import { filterBankInsightsForSuitability } from '../../src/data/bankInsights';
import { formatRate, isNonStandard, toFraction } from '../../src/data/format';
import { normalizedProductFacts } from '../../src/data/productFacts';
import { sortRows, findByKey } from '../../src/data/selectors';
import { selectBankHistoryChartModel } from '../../src/data/historySelectors';
import {
  countFiniteSeriesPoints,
  forwardFillSeriesRecord,
  productSeriesRecordWithCurrent,
} from '../../src/data/productHistory';
import { ensurePermissions } from '../../src/data/notifications';
import { useStore } from '../../src/data/store';
import { isSavedRate } from '../../src/data/savedRates';
import { usePerformanceAuditSurface } from '../../src/hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../../src/hooks/useLogoReadiness';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import { useUserRateScenario } from '../../src/hooks/useUserRateScenario';
import { StaySwitchChart } from '../../src/components/scenario/StaySwitchChart';
import { buildStaySwitchProjection } from '../../src/data/staySwitchProjection';
import { NOT_LISTED_PROVIDER } from '../../src/data/userRateScenario';
import { openBank, openRateReceipt } from '../../src/lib/nav';
import { rateQualifier } from '../../src/lib/rateQualifier';
import { logSwallowedError } from '../../src/lib/degradationLog';
import {
  effectiveBankInsights,
  effectiveHistoryRibbon,
} from '../../src/lib/proAccess';
import { yieldToUi } from '../../src/lib/yieldToUi';
import {
  auditActionString,
} from '../../src/lib/performanceAuditActionParams';
import { relativeDate } from '../../src/data/format';
import { ratePresentation } from '../../src/data/ratePresentation';
import { useTheme } from '../../src/theme/ThemeProvider';
import {
  isCurrentHistoryGraphicEvidence,
  type HistoryGraphicEvidence,
} from '../../src/lib/historyGraphicEvidence';

export default function ProductDetail() {
  const suitabilityRevision = useSuitabilityRevision();
  const theme = useTheme();
  const { key, ri } = useLocalSearchParams<{ key: string; ri?: string }>();
  const productKey = key ?? '';
  const exactRateRequested = ri != null && ri !== '';
  const parsedRateIndex = exactRateRequested ? Number(ri) : null;
  const rateIndex = parsedRateIndex != null && Number.isInteger(parsedRateIndex) ? parsedRateIndex : null;
  const core = useStore((s) => s.core);
  const coreIntegrity = useStore((s) => s.coreIntegrity);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256);
  const historyBanksSha = useStore((s) => s.manifest?.files.history_banks?.sha256 ?? null);
  const bankInsightsSha = useStore((s) => s.manifest?.files.bank_history?.sha256 ?? null);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const detail = useStore((s) => s.details?.products[productKey] ?? null);
  const normalizedFactKinds = useMemo(
    () => new Set(normalizedProductFacts(detail).map((fact) => fact.kind)),
    [detail],
  );
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const detailsLoading = useStore((s) => s.detailsLoading);
  const savedRates = useStore((s) => s.savedRates);
  const toggleSavedRate = useStore((s) => s.toggleSavedRate);
  const notificationsEnabled = useStore((s) => s.prefs.notificationsEnabled);
  const setPref = useStore((s) => s.setPref);
  const subscribed = useStore((s) => s.isProductSubscribed(productKey, rateIndex));
  const subscribeProduct = useStore((s) => s.subscribeProduct);
  const unsubscribeProduct = useStore((s) => s.unsubscribeProduct);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const historyEnabled = useStore((s) => effectiveHistoryRibbon(s.prefs));
  const showBankInsights = effectiveBankInsights();
  const historyBanks = useStore((s) => s.historyBanks);
  const bankInsights = useStore((s) => s.bankInsights);
  const bankInsightsError = useStore((s) => s.bankInsightsError);
  const productHistory = useStore((s) => s.productHistory);
  const productHistoryError = useStore((s) => s.productHistoryError);
  const ensureHistoryBanks = useStore((s) => s.ensureHistoryBanks);
  const ensureBankInsights = useStore((s) => s.ensureBankInsights);
  const ensureProductHistory = useStore((s) => s.ensureProductHistory);
  const insightsRequestKey = useRef<string | null>(null);
  const historyAuditActionsRef = useRef<BankHistoryChartAuditActions | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [historyGraphicEvidence, setHistoryGraphicEvidence] =
    useState<HistoryGraphicEvidence | null>(null);
  const { scenario } = useUserRateScenario();

  useEffect(() => {
    void ensureDetails({ forProductView: true });
  }, [ensureDetails]);

  useEffect(() => {
    if (!showBankInsights) {
      insightsRequestKey.current = null;
      return;
    }
    const key = core?.run_date ?? null;
    if (!key || insightsRequestKey.current === key) return;
    insightsRequestKey.current = key;
    void ensureBankInsights();
  }, [core?.run_date, ensureBankInsights, showBankInsights]);

  useEffect(() => {
    if (!historyEnabled) return;
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
    productKey,
  ]);

  const found = useMemo(
    () => core ? findByKey(core.sections, productKey) : null,
    [core, productKey],
  );
  const row = found
    ? exactRateRequested
      ? rateIndex == null
        ? null
        : found.siblings.find((candidate) => candidate.rate_index === rateIndex) ?? null
      : found.row
    : null;
  const staySwitchProjection = useMemo(() => {
    if (!row || found?.section !== 'Mortgage' || !detail || !detailsProducts) return null;
    const currentRef = scenario.currentProducts.mortgage;
    return buildStaySwitchProjection({
      scenario,
      target: row,
      currentDetail: currentRef.productKey ? detailsProducts[currentRef.productKey] : null,
      targetDetail: detail,
    });
  }, [detail, detailsProducts, found?.section, row, scenario]);
  const currentBankLabel = scenario.currentProducts.mortgage.provider
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

  const historyModel = useMemo(() => {
    void suitabilityRevision;
    if (!historyEnabled || !core || !found) return null;
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
  ]);

  // Single-day fallback is a misleading solid RBA block; wait for multi-day context
  // when Standard-only mode is relying on bank insights that have not arrived yet.
  // Stop waiting once insights fail so the empty/collecting copy can show.
  const historyWaitingForInsights =
    historyEnabled &&
    !includeNonStandard &&
    showBankInsights &&
    !explorerInsights &&
    !bankInsightsError &&
    (!historyModel || historyModel.dates.length < 2);
  const historyContentRevision = [
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
  const auditActions = useMemo(() => {
    const actions: Record<string, (...args: unknown[]) => unknown> = {
      'product.open': () => undefined,
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
  }, [historyGraphicEvidence?.window, productKey, row]);
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
  const onHistoryGraphicReady = React.useCallback((evidence: HistoryGraphicEvidence) => {
    setHistoryGraphicEvidence((current) => {
      return current?.graphicRevision === evidence.graphicRevision &&
        current.pointCount === evidence.pointCount &&
        current.accessibleSummary === evidence.accessibleSummary
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
        status: core && row ? 'ready' : 'pending',
        datasetRevision: core?.run_date ?? null,
      },
      {
        id: 'product.details-data',
        kind: 'data',
        status: detailsProducts && !detailsLoading ? 'ready' : 'pending',
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
        status: historyWaitingForInsights
          ? 'pending'
          : !historyModel || currentHistoryGraphicEvidence
            ? 'ready'
            : 'pending',
        expectedCount: currentHistoryGraphicEvidence?.pointCount ?? 0,
        actualCount: currentHistoryGraphicEvidence?.pointCount ?? 0,
        accessibleSummary: currentHistoryGraphicEvidence?.accessibleSummary ?? false,
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

  if (!found) {
    return (
      <>
        <Stack.Screen options={{ title: 'Product' }} />
        <EmptyState icon="alert-circle-outline" title="Product not found" />
      </>
    );
  }

  const { section, siblings } = found;
  if (!row) {
    return (
      <>
        <Stack.Screen options={{ title: 'Product rate unavailable' }} />
        <EmptyState
          icon="alert-circle-outline"
          title="Exact rate no longer available"
          subtitle="This rate is no longer in the current catalogue. Choose a current product tier instead."
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
  const accent = meta.lowerIsBetter ? theme.colors.success : theme.colors.primary;
  const rateRows = sortRows(siblings, 'rate', section, depositRankMetric, mortgageRateMetric);
  const qualifier = rateQualifier(row, section);
  const presentation = ratePresentation(row, section, mortgageRateMetric);

  const sectionInk = meta.lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit;
  // Distinct from the market ribbon ink so the product line/marker stays readable.
  const productInk = theme.colors.warning;
  // Match productHistory's section-best pick so the seeded point aligns with synced series.
  let currentBest: number | null = null;
  for (const sibling of siblings) {
    const rate = toFraction(sibling.rate);
    if (rate == null || rate <= 0) continue;
    if (currentBest == null) currentBest = rate;
    else currentBest = meta.lowerIsBetter ? Math.min(currentBest, rate) : Math.max(currentBest, rate);
  }
  const chartDates = historyModel?.allDates ?? historyModel?.dates ?? [];
  // Build seeded series once — avoid a second full scan just for point counts.
  const seededProductValues = productSeriesRecordWithCurrent(
    productHistory,
    productKey,
    core?.run_date,
    currentBest,
  );
  const productSeries = {
    values: chartDates.length
      ? forwardFillSeriesRecord(seededProductValues, chartDates)
      : seededProductValues,
    label: row.product_name,
    color: productInk,
  };
  const observedProductPoints = countFiniteSeriesPoints(seededProductValues);
  const productHasHighlight = observedProductPoints > 0;

  const onShare = () =>
    Share.share({
      message: `${row.provider} — ${row.product_name}: ${formatRate(presentation.primary)} ${presentation.primaryLabel.toLowerCase()} (${meta.title}, Australian Rates)`,
    }).catch((err) => logSwallowedError('product.share', err));

  const onToggleNotify = async () => {
    if (subscribed) {
      unsubscribeProduct(productKey, rateIndex);
      return;
    }
    const ok = await ensurePermissions();
    if (!ok) {
      Alert.alert('Notifications disabled', 'Enable notifications for Australian Rates in system settings.');
      return;
    }
    if (!notificationsEnabled) {
      setPref('notificationsEnabled', true);
    }
    subscribeProduct(productKey, rateIndex, row);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: row.provider,
          headerRight: () => (
            <Row gap={2}>
              {favorite || subscribed ? (
                <IconButton
                  icon={subscribed ? 'notifications' : 'notifications-outline'}
                  color={subscribed ? 'primary' : 'text'}
                  onPress={() => void onToggleNotify()}
                  accessibilityLabel={subscribed ? 'Remove rate alert' : 'Notify on rate change'}
                />
              ) : null}
              <IconButton
                icon={favorite ? 'star' : 'star-outline'}
                color={favorite ? 'warning' : 'text'}
                onPress={() => toggleSavedRate(row, saveScope)}
                accessibilityLabel={favorite
                  ? exactSaveEligible ? 'Remove this rate from My rates' : 'Remove this product from My rates'
                  : exactSaveEligible ? 'Save this exact rate to My rates' : 'Save all product variants to My rates'}
              />
              <IconButton icon="share-outline" onPress={onShare} accessibilityLabel="Share" />
              <NavigationMenuButton />
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
            size={56}
            renderStateId={productLogoIds[0]}
            onRenderStateChange={logoReadiness.onLogoRenderStateChange}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">{row.product_name}</AppText>
            <AppText variant="small" color="textMuted">
              {row.provider} · {meta.title}
            </AppText>
          </View>
        </Row>

        <Card style={{ marginBottom: 16, alignItems: 'center' }}>
          <AppText variant="small" color="textMuted">
            {presentation.primaryLabel}
          </AppText>
          <AppText variant="h1" weight="800" style={{ color: accent, marginVertical: 2 }}>
            {formatRate(presentation.primary)}
          </AppText>
          {presentation.secondary !== null && presentation.secondaryLabel ? (
            <AppText variant="small" color="textFaint">
              {formatRate(presentation.secondary)} {presentation.secondaryLabel.toLowerCase()}
            </AppText>
          ) : null}
          <ProductRateChangeLine
            productKey={productKey}
            section={section}
            current={{ date: core?.run_date, rate: currentBest }}
          />
          <AppText variant="tiny" color="textFaint" style={{ marginTop: 6 }}>
            Exact published tier · observed {core?.run_date}
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
                Special eligibility
              </AppText>
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
              <AppText
                variant="small"
                color="textMuted"
                style={{ marginTop: 8, textAlign: 'center', lineHeight: 18 }}
              >
                {qualifier.note}
              </AppText>
            </>
          ) : null}
        </Card>

        {staySwitchProjection?.ready ? (
          <View style={{ marginBottom: 16 }}>
            <StaySwitchChart
              projection={staySwitchProjection}
              currentBank={currentBankLabel}
              compact
              onOpenFull={() => router.push({
                pathname: '/projections',
                params: {
                  section: 'Mortgage',
                  target: row.product_key,
                  ri: row.rate_index != null ? String(row.rate_index) : undefined,
                },
              } as never)}
            />
          </View>
        ) : (
          <Card variant="outlined" style={{ marginBottom: 16, gap: 10 }}>
            <AppText variant="body" weight="700">Compare this observed rate with your scenario</AppText>
            <AppText variant="tiny" color="textMuted">
              Full projections keep assumptions, unknown fees and unavailable results visible.
            </AppText>
            <Button
              title="Add my rate"
              variant="secondary"
              onPress={() => router.push({ pathname: '/calculator', params: { intent: 'check', section } })}
            />
          </Card>
        )}

        <AccessNotice name={row.product_name} provider={row.provider} detail={detail} loading={detailsLoading} />

        {detail?.description ? (
          <AppText variant="small" color="textMuted" style={{ marginBottom: 16, lineHeight: 20 }}>
            {detail.description}
          </AppText>
        ) : null}

        <ProductSpecs row={row} section={section} detail={detail} />

        <Button
          title={favorite
            ? 'Saved to My rates'
            : exactSaveEligible ? 'Save exact rate to My rates' : 'Save product to My rates'}
          icon={favorite ? 'star' : 'star-outline'}
          style={{ marginBottom: 10 }}
          onPress={() => toggleSavedRate(row, saveScope)}
        />
        <Button
          title="Prepare a bank call"
          icon="receipt-outline"
          variant="secondary"
          style={{ marginBottom: 16 }}
          onPress={() => openRateReceipt(productKey, row.rate_index)}
        />

        <SectionTitle text="Rate history" icon="trending-up-outline" />
        <Card style={{ marginBottom: 16 }}>
          {historyEnabled ? (
            historyWaitingForInsights ? (
              <AppText variant="small" color="textMuted">
                Loading market history…
              </AppText>
            ) : historyModel && historyModel.dates.length >= 2 ? (
              <>
                <AppText variant="tiny" color="textFaint" style={{ marginBottom: 8 }}>
                  {row.product_name} vs all {meta.title.toLowerCase()} rates
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
                {productHistoryError && observedProductPoints < 2 ? (
                  <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                    <AppText variant="tiny" color="danger" style={{ flex: 1 }}>
                      Couldn&apos;t load this product&apos;s history.
                    </AppText>
                    <Button
                      title="Retry"
                      variant="ghost"
                      onPress={() => void ensureProductHistory({ force: true })}
                    />
                  </Row>
                ) : observedProductPoints < 2 ? (
                  <AppText variant="tiny" color="textFaint" style={{ marginTop: 6 }}>
                    {formatRate(currentBest)} today · gathering prior daily rates so the full line
                    can draw
                  </AppText>
                ) : null}
              </>
            ) : (
              <AppText variant="small" color="textMuted">
                Rate history appears once more daily observations are available.
              </AppText>
            )
          ) : (
            <>
              <AppText variant="small" color="textMuted" style={{ marginBottom: 10, lineHeight: 20 }}>
                See how {row.product_name}&apos;s rate moved over time against the market&apos;s mean and median.
              </AppText>
              <Button
                title="Show rate history"
                icon="analytics-outline"
                variant="secondary"
                onPress={() => setPref('showHistoryRibbon', true)}
              />
            </>
          )}
        </Card>

        <ProductFacts detail={detail} />
        <DetailGroup title="Features" icon="checkmark-circle-outline" items={normalizedFactKinds.has('feature') ? undefined : detail?.features} loading={detailsLoading && !normalizedFactKinds.has('feature')} />
        <DetailGroup title="Fees" icon="cash-outline" items={detail?.fees} loading={detailsLoading} />
        <DetailGroup title="Eligibility" icon="person-outline" items={normalizedFactKinds.has('eligibility') ? undefined : detail?.eligibility} loading={detailsLoading && !normalizedFactKinds.has('eligibility')} />
        <DetailGroup title="Constraints" icon="lock-closed-outline" items={normalizedFactKinds.has('constraint') ? undefined : detail?.constraints} loading={detailsLoading && !normalizedFactKinds.has('constraint')} />

        <OfficialLinks links={detail?.links} />

        <Button
          title={`View all ${row.provider} products`}
          icon="business-outline"
          variant="secondary"
          style={{ marginTop: 4 }}
          onPress={() => openBank(row.provider)}
        />

        <ProductRatesList rows={rateRows} section={section} accent={accent} />

        <Button
          title={productWideSaved ? 'Stop watching all tiers' : 'Watch every tier for this product'}
          icon={productWideSaved ? 'star' : 'star-outline'}
          variant="ghost"
          style={{ marginBottom: 16 }}
          onPress={() => toggleSavedRate(row, 'product')}
        />

        {row.last_updated ? (
          <AppText variant="tiny" color="textFaint" style={{ textAlign: 'center', marginTop: 14 }}>
            Lender data updated {relativeDate(row.last_updated)}
          </AppText>
        ) : null}
      </ScreenScrollView>
    </>
  );
}
