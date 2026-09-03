import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Pressable, type ScrollView, View } from 'react-native';

import { BankAvatar } from '../../src/components/BankAvatar';
import {
  BankHistoryChart,
  type BankHistoryChartAuditActions,
} from '../../src/components/BankHistoryChart';
import { BankMoveRow } from '../../src/components/BankInsights';
import { ChartErrorBoundary } from '../../src/components/ChartErrorBoundary';
import { EmptyState, ScreenSkeleton } from '../../src/components/feedback';
import { ProductCard } from '../../src/components/ProductCard';
import { ScreenScrollView } from '../../src/components/Screen';
import { SegmentedControl } from '../../src/components/controls';
import { AppText, Card, Chip, Divider, Row } from '../../src/components/ui';
import { SECTIONS, SECTION_ORDER } from '../../src/constants';
import {
  bankEventMedianContext,
  bankTrendChartModel,
  filterBankInsightsForSuitability,
  recentBankEvents,
  type BankEventRateContext,
  type BankRateEvent,
} from '../../src/data/bankInsights';
import { formatRate, formatRunDate, visibleAccountRows } from '../../src/data/format';
import {
  productHistoryRepresentsRateRow,
  productMoveBreakdownForCatalog,
  type ProductMoveCatalogEntry,
  type ProductRateMove,
} from '../../src/data/productHistory';
import { excludeTokenDepositRates, sortRows } from '../../src/data/selectors';
import { useStore } from '../../src/data/store';
import { usePerformanceAuditSurface } from '../../src/hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../../src/hooks/useLogoReadiness';
import { openProduct } from '../../src/lib/nav';
import {
  auditActionInteger,
  auditActionString,
} from '../../src/lib/performanceAuditActionParams';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import { moveTone, moveVerb } from '../../src/lib/moveSemantics';
import { effectiveBankInsights } from '../../src/lib/proAccess';
import { yieldToUi } from '../../src/lib/yieldToUi';
import { isPerformanceAuditActive } from '../../src/lib/performanceAudit';
import {
  isCurrentHistoryGraphicEvidence,
  type HistoryGraphicEvidence,
} from '../../src/lib/historyGraphicEvidence';
import type { RateRow, SectionKey } from '../../src/types';
import { SECTION_KEYS } from '../../src/types';
import { useTheme } from '../../src/theme/ThemeProvider';

function bpsLabel(bps: number): string {
  const rounded = Math.round(bps * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)} bps`;
}

function percentagePointLabel(bps: number): string {
  const points = Math.abs(bps / 100);
  const sign = bps > 0 ? '+' : bps < 0 ? '−' : '';
  return `${sign}${points.toFixed(2)} percentage points`;
}

function isSectionKey(value: string | undefined): value is SectionKey {
  return !!value && (SECTION_KEYS as readonly string[]).includes(value);
}

function eventForVisibleProducts(
  source: BankRateEvent,
  matched: number,
  moves: readonly ProductRateMove[],
): BankRateEvent | null {
  if (!moves.length || matched <= 0) return null;
  const hasIncrease = moves.some((move) => move.bps > 0);
  const hasDecrease = moves.some((move) => move.bps < 0);
  const avgBps = moves.reduce((sum, move) => sum + move.bps, 0) / moves.length;
  return {
    ...source,
    dir: hasIncrease && hasDecrease ? 'mixed' : hasIncrease ? 'hike' : 'cut',
    moved: moves.length,
    total: matched,
    avg_bps: Math.round(avgBps * 10) / 10,
  };
}

const ProductMoveRow = React.memo(function ProductMoveRow({
  move,
  section,
}: {
  move: ProductRateMove;
  section: SectionKey;
}) {
  const theme = useTheme();
  const tone = moveTone(section, move.bps);
  const color =
    tone === 'danger' ? theme.colors.danger : tone === 'success' ? theme.colors.success : theme.colors.textMuted;
  return (
    <Pressable
      onPress={() => openProduct(move.productKey, move.rateIndex ?? undefined)}
      accessibilityRole="button"
      accessibilityLabel={`${move.productName} moved ${bpsLabel(move.bps)} from ${formatRate(move.fromRate)} to ${formatRate(move.toRate)} on ${formatRunDate(move.date)}`}
    >
      <Row gap={10} style={{ paddingVertical: 8 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="small" weight="700" numberOfLines={2}>
            {move.productName}
          </AppText>
          <AppText variant="tiny" color="textFaint" numberOfLines={1}>
            {formatRunDate(move.date)} · {formatRate(move.fromRate)} → {formatRate(move.toRate)}
          </AppText>
        </View>
        <AppText variant="small" weight="800" style={{ color }}>
          {bpsLabel(move.bps)}
        </AppText>
      </Row>
    </Pressable>
  );
});

export default function BankDetail() {
  // Already decoded by expo-router — decoding again would throw on a literal '%'.
  const {
    provider: raw,
    date: focusDateRaw,
    section: focusSectionRaw,
  } = useLocalSearchParams<{ provider: string; date?: string; section?: string }>();
  const provider = raw ?? '';
  const focusDate = typeof focusDateRaw === 'string' ? focusDateRaw.slice(0, 10) : '';
  const focusSection = isSectionKey(
    Array.isArray(focusSectionRaw) ? focusSectionRaw[0] : focusSectionRaw,
  )
    ? ((Array.isArray(focusSectionRaw) ? focusSectionRaw[0] : focusSectionRaw) as SectionKey)
    : null;

  const router = useRouter();
  const core = useStore((s) => s.core);
  const coreIntegrity = useStore((s) => s.coreIntegrity);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? null);
  const bankInsightsSha = useStore((s) => s.manifest?.files.bank_history?.sha256 ?? null);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const showBankInsights = effectiveBankInsights();
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const suitabilityRevision = useSuitabilityRevision();
  const bankInsights = useStore((s) => s.bankInsights);
  const ensureBankInsights = useStore((s) => s.ensureBankInsights);
  const productHistoryError = useStore((s) => s.productHistoryError);
  const ensureProductHistory = useStore((s) => s.ensureProductHistory);
  // Gate the heavy productHistory subscription until after first paint / interactions
  // so opening a bank from Outlook never stalls on a multi‑MB store update.
  const [productHistoryReady, setProductHistoryReady] = useState(false);
  const productHistory = useStore((s) => (productHistoryReady ? s.productHistory : null));
  const insightsRequestKey = useRef<string | null>(null);
  const historyRequestKey = useRef<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const historyAuditActionsRef = useRef<BankHistoryChartAuditActions | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [historyGraphicEvidence, setHistoryGraphicEvidence] =
    useState<HistoryGraphicEvidence | null>(null);

  const rawBankEvents = useMemo(
    () => recentBankEvents(bankInsights, { provider }),
    [bankInsights, provider],
  );

  useEffect(() => {
    const key = showBankInsights ? core?.run_date ?? null : null;
    if (!key || insightsRequestKey.current === key) return;
    insightsRequestKey.current = key;
    void ensureBankInsights();
  }, [core?.run_date, ensureBankInsights, showBankInsights]);

  useEffect(() => {
    // Product-level move drill-down needs the on-device product history ledger.
    // Do NOT pull history_banks here — bank trend charts use bankInsights only.
    // Subscribe to an existing cache after paint, but only warm the multi-day
    // ledger after the user explicitly opens a dated move drill-down.
    if (!showBankInsights) {
      historyRequestKey.current = null;
      setProductHistoryReady(false);
      return;
    }
    const key = core?.run_date ?? null;
    if (!key) return;
    const shouldFetch = !!(focusDate && focusSection);
    if (!shouldFetch) historyRequestKey.current = null;
    if (isPerformanceAuditActive()) {
      setProductHistoryReady(true);
      if (shouldFetch && historyRequestKey.current !== key) {
        historyRequestKey.current = key;
        void ensureProductHistory({ purpose: 'bank_move' });
      }
      return;
    }
    let cancelled = false;
    const handle = InteractionManager.runAfterInteractions(() => {
      void yieldToUi().then(() => {
        if (cancelled) return;
        setProductHistoryReady(true);
        if (!shouldFetch || historyRequestKey.current === key) return;
        historyRequestKey.current = key;
        void ensureProductHistory({ purpose: 'bank_move' });
      });
    });
    return () => {
      cancelled = true;
      handle.cancel?.();
    };
  }, [
    core?.run_date,
    ensureProductHistory,
    focusDate,
    focusSection,
    showBankInsights,
  ]);

  const bySection = useMemo(() => {
    void suitabilityRevision;
    const out: { section: SectionKey; rows: RateRow[] }[] = [];
    if (!core) return out;
    for (const section of SECTION_ORDER) {
      const rows = excludeTokenDepositRates(
        visibleAccountRows(
          core.sections[section]?.rates?.filter((r) => r.provider === provider) ?? [],
          includeNonStandard,
          detailsProducts,
        ),
        section,
      );
      // De-duplicate to one card per product (best rate row under the ranking metric).
      const byProduct = new Map<string, RateRow>();
      for (const r of sortRows(rows, 'rate', section, depositRankMetric, mortgageRateMetric)) {
        if (!byProduct.has(r.product_key)) byProduct.set(r.product_key, r);
      }
      if (byProduct.size) out.push({ section, rows: Array.from(byProduct.values()) });
    }
    return out;
  }, [core, provider, depositRankMetric, mortgageRateMetric, includeNonStandard, detailsProducts, suitabilityRevision]);

  const catalogsBySection = useMemo(() => {
    // Keep event denominators and product names in the exact same scope as the
    // cards below, but only where the selected row is also the product-best
    // rate represented by the product-key history ledger. Withhold ambiguous
    // base/bonus or comparison-selected rows rather than misattribute a move.
    const out: Partial<Record<SectionKey, ProductMoveCatalogEntry[]>> = {};
    for (const { section, rows } of bySection) {
      out[section] = rows.flatMap((row) => {
        if (!productHistoryRepresentsRateRow(core, row)) return [];
        return [{
          productKey: row.product_key,
          productName: (row.product_name && row.product_name.trim()) || row.product_key,
          rateIndex: typeof row.rate_index === 'number' ? row.rate_index : null,
        }];
      });
    }
    return out;
  }, [bySection, core]);

  const visibleBankInsights = useMemo(
    () =>
      filterBankInsightsForSuitability(
        bankInsights,
        core,
        includeNonStandard,
        detailsProducts,
        suitabilityRevision,
        coreIntegrity,
      ),
    [bankInsights, core, coreIntegrity, detailsProducts, includeNonStandard, suitabilityRevision],
  );

  const visibleBankEvents = useMemo(
    () => recentBankEvents(visibleBankInsights, { provider }),
    [provider, visibleBankInsights],
  );

  const chartSections = useMemo(
    () =>
      SECTION_ORDER.filter((section) => !!visibleBankInsights?.banks?.[provider]?.[section]),
    [provider, visibleBankInsights],
  );
  const [chartSection, setChartSection] = useState<SectionKey | null>(null);
  const activeChartSection =
    chartSection && chartSections.includes(chartSection)
      ? chartSection
      : focusSection && chartSections.includes(focusSection)
        ? focusSection
        : chartSections[0] ?? null;

  const chartModel = useMemo(
    () =>
      activeChartSection
        ? bankTrendChartModel(visibleBankInsights, provider, activeChartSection)
        : null,
    [activeChartSection, provider, visibleBankInsights],
  );
  const historyContentRevision = [
    bankInsightsSha ?? 'no-bank-history-sha',
    provider,
    activeChartSection ?? 'none',
    chartModel?.dates.at(-1) ?? 'none',
    chartModel?.dates.length ?? 0,
  ].join(':');
  const onHistoryGraphicReady = useCallback((evidence: HistoryGraphicEvidence) => {
    setHistoryGraphicEvidence((current) => {
      return current?.graphicRevision === evidence.graphicRevision &&
        current.pointCount === evidence.pointCount &&
        current.accessibleSummary === evidence.accessibleSummary
        ? current
        : evidence;
    });
  }, []);

  const focusSourceEvent: BankRateEvent | null = useMemo(() => {
    if (!focusDate || !focusSection) return null;
    return (
      rawBankEvents.find((e) => e.date === focusDate && e.section === focusSection) ??
      recentBankEvents(bankInsights, { provider }).find(
        (e) => e.date === focusDate && e.section === focusSection,
      ) ??
      null
    );
  }, [bankInsights, focusDate, focusSection, provider, rawBankEvents]);

  const eventBreakdowns = useMemo(() => {
    if (!productHistory) return [] as { event: BankRateEvent; moves: ProductRateMove[] }[];
    const out: { event: BankRateEvent; moves: ProductRateMove[] }[] = [];
    for (const source of rawBankEvents) {
      const breakdown = productMoveBreakdownForCatalog(
        productHistory,
        catalogsBySection[source.section] ?? [],
        { date: source.date },
      );
      const event = eventForVisibleProducts(source, breakdown.matched, breakdown.moves);
      if (event) {
        out.push({ event, moves: breakdown.moves });
        if (out.length === 8) break;
      }
    }
    return out;
  }, [catalogsBySection, productHistory, rawBankEvents]);

  const bankEvents = useMemo(
    () => eventBreakdowns.map(({ event }) => event),
    [eventBreakdowns],
  );

  const focusBreakdown = useMemo(() => {
    if (!focusSourceEvent || !focusSection || !productHistory) return null;
    const breakdown = productMoveBreakdownForCatalog(
      productHistory,
      catalogsBySection[focusSection] ?? [],
      { date: focusSourceEvent.date },
    );
    const event = eventForVisibleProducts(
      focusSourceEvent,
      breakdown.matched,
      breakdown.moves,
    );
    return { event, matched: breakdown.matched, moves: breakdown.moves };
  }, [catalogsBySection, focusSection, focusSourceEvent, productHistory]);

  const focusEvent = focusBreakdown?.event ?? null;
  const focusedMoves = focusBreakdown?.moves ?? [];
  const focusHistoryState = useMemo(() => {
    if (!focusSourceEvent || !focusSection) return 'idle' as const;
    if (!productHistory) return 'loading' as const;
    if (!(catalogsBySection[focusSection]?.length)) return 'unsafe' as const;
    if (!productHistory.run_dates.includes(focusSourceEvent.date)) return 'incomplete' as const;
    if (!focusBreakdown?.matched) return 'incomplete' as const;
    return focusEvent ? 'matched' as const : 'none' as const;
  }, [catalogsBySection, focusBreakdown?.matched, focusEvent, focusSection, focusSourceEvent, productHistory]);

  const displayBankEvents = useMemo(
    () => (productHistory ? bankEvents : visibleBankEvents.slice(0, 8)),
    [bankEvents, productHistory, visibleBankEvents],
  );

  const bankEventContexts = useMemo(() => {
    const map = new Map<string, BankEventRateContext | null>();
    for (const event of displayBankEvents) {
      map.set(
        `${event.date}:${event.section}`,
        bankEventMedianContext(visibleBankInsights, event),
      );
    }
    return map;
  }, [displayBankEvents, visibleBankInsights]);

  const focusRateCtx = useMemo(
    () => (focusEvent ? bankEventMedianContext(visibleBankInsights, focusEvent) : null),
    [focusEvent, visibleBankInsights],
  );

  const recentMoveBreakdowns = focusSourceEvent ? [] : eventBreakdowns.slice(0, 3);

  const productCount = useMemo(() => bySection.reduce((n, s) => n + s.rows.length, 0), [bySection]);

  const handleMoveSelect = useCallback(
    (event: BankRateEvent) => {
      router.setParams({ date: event.date, section: event.section });
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
    },
    [router],
  );
  const auditActions = useMemo(() => {
    const actions: Record<string, (...args: unknown[]) => unknown> = {
      // Do not claim product.lender.open here — a stale mounted lender surface
      // would no-op the product-page action and abort the deep audit.
      'lender.product.first': (...args: unknown[]) => {
      const productKey = auditActionString(args, 'productKey');
      const rateIndex = auditActionInteger(args, 'rateIndex');
      const exact = SECTION_ORDER
        .flatMap((section) => core?.sections[section].rates ?? [])
        .find((candidate) => candidate.product_key === productKey &&
          candidate.provider === provider &&
          (rateIndex == null || candidate.rate_index === rateIndex));
        if (!exact) return { unavailableReason: 'The exact planned lender product is not rendered' };
        openProduct(exact.product_key, exact.rate_index);
        return { expectedPath: `/product/${encodeURIComponent(exact.product_key)}` };
      },
      'lender.chart.section.next': () => ({
        unavailableReason: 'This lender has fewer than two rendered chart sections',
      }),
      'lender.history.window.next': () => ({
        unavailableReason: 'This lender has no rendered multi-window history chart',
      }),
      'lender.history.date.previous': () => ({
        unavailableReason: 'This lender has no rendered multi-date history chart',
      }),
      'lender.move.first': () => ({
        unavailableReason: 'This lender has no rendered observed move',
      }),
    };
    if (chartSections.length > 1) {
      actions['lender.chart.section.next'] = () => {
        const index = activeChartSection ? chartSections.indexOf(activeChartSection) : -1;
        const next = chartSections[(Math.max(0, index) + 1) % chartSections.length];
        if (next) setChartSection(next);
      };
    }
    if (chartModel && activeChartSection) {
      actions['lender.history.window.next'] = () => {
        setHistoryGraphicEvidence(null);
        historyAuditActionsRef.current?.selectNextWindow();
      };
      actions['lender.history.date.previous'] = () =>
        historyAuditActionsRef.current?.selectPreviousDate();
    }
    const firstMove = bankEvents[0] ?? visibleBankEvents[0];
    if (firstMove) {
      actions['lender.move.first'] = () => {
        handleMoveSelect(firstMove);
        return { expectedPath: `/bank/${encodeURIComponent(provider)}` };
      };
    }
    return actions;
  }, [activeChartSection, bankEvents, chartModel, chartSections, core, handleMoveSelect, provider, visibleBankEvents]);
  const lenderLogoIds = useMemo(
    () => provider ? [`lender:header:${provider}`] : [],
    [provider],
  );
  const logoReadiness = useLogoReadiness(provider, lenderLogoIds);
  const moveHistoryRequired = showBankInsights && !!(focusDate && focusSection);
  const currentHistoryGraphicEvidence = isCurrentHistoryGraphicEvidence(
    historyGraphicEvidence,
    historyContentRevision,
  ) ? historyGraphicEvidence : null;
  usePerformanceAuditSurface({
    id: 'lender.details',
    routeKey: '/bank/[provider]',
    datasetRevision: coreSha ?? core?.run_date ?? null,
    renderRevision: `${provider}:${productCount}:${historyContentRevision}:${currentHistoryGraphicEvidence?.graphicRevision ?? 'graphic-pending'}:${focusHistoryState}:${productHistory ? `moves-${bankEvents.length}` : 'moves-on-demand'}`,
    actions: auditActions,
    probes: [
      {
        id: 'lender.data',
        kind: 'data',
        status: core ? 'ready' : 'pending',
        datasetRevision: coreSha ?? core?.run_date ?? null,
      },
      {
        id: 'lender.products',
        kind: 'list',
        status: core ? 'ready' : 'pending',
        expectedCount: productCount,
        actualCount: productCount,
      },
      {
        id: 'lender.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
      },
      {
        id: 'lender.logo',
        kind: 'logo',
        status: provider && logoReadiness.ready ? 'ready' : 'pending',
        expectedCount: logoReadiness.expectedCount,
        actualCount: logoReadiness.terminalCount,
        fallbackCount: logoReadiness.fallbackCount,
      },
      {
        id: 'lender.history-data',
        kind: 'data',
        required: false,
        status: showBankInsights && !bankInsights ? 'pending' : 'ready',
        actualCount: chartModel?.dates.length ?? 0,
      },
      {
        id: 'lender.history-graphic',
        kind: 'graphic',
        required: false,
        status: !chartModel || currentHistoryGraphicEvidence
          ? 'ready'
          : 'pending',
        expectedCount: currentHistoryGraphicEvidence?.pointCount ?? 0,
        actualCount: currentHistoryGraphicEvidence?.pointCount ?? 0,
        accessibleSummary: currentHistoryGraphicEvidence?.accessibleSummary ?? false,
      },
      {
        id: 'lender.product-history-data',
        kind: 'data',
        required: moveHistoryRequired,
        status: !moveHistoryRequired
          ? 'ready'
          : productHistoryError
            ? 'error'
            : focusHistoryState === 'loading'
              ? 'pending'
              : 'ready',
        error: moveHistoryRequired ? productHistoryError : null,
        expectedCount: moveHistoryRequired ? 1 : 0,
        actualCount: moveHistoryRequired && productHistory ? 1 : 0,
      },
    ],
  });

  if (!core) return <ScreenSkeleton />;

  const currentProducts = bySection.length === 0 ? (
    <EmptyState title="No current products" subtitle="This lender has no rates in the current data set." />
  ) : (
    bySection.map(({ section, rows }) => (
      <View key={section} style={{ marginBottom: 12 }}>
        <AppText variant="small" weight="700" color="textMuted" style={{ marginBottom: 8, marginLeft: 4 }}>
          {SECTIONS[section].title.toUpperCase()}
        </AppText>
        {rows.map((r) => (
          <ProductCard
            key={r.product_key}
            row={r}
            section={section}
            showLenderAction={false}
            logoRenderStateId={`lender:${section}:${r.rate_index ?? 'default'}#${r.product_key}`}
            onLogoRenderStateChange={logoReadiness.onLogoRenderStateChange}
            onPress={() => openProduct(r.product_key, r.rate_index)}
          />
        ))}
      </View>
    ))
  );

  return (
    <>
      <Stack.Screen options={{ title: provider }} />
      <ScreenScrollView
        ref={scrollRef}
        onLayout={() => setLayoutReady(true)}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <Row gap={14} style={{ marginBottom: 20 }}>
          <BankAvatar
            provider={provider}
            size={56}
            renderStateId={lenderLogoIds[0]}
            onRenderStateChange={logoReadiness.onLogoRenderStateChange}
          />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">{provider}</AppText>
            <AppText variant="small" color="textMuted">
              {productCount} {productCount === 1 ? 'product' : 'products'}
              {!includeNonStandard ? ' · widely available' : ''}
            </AppText>
          </View>
        </Row>

        {showBankInsights && displayBankEvents[0] ? (
          <Card variant="outlined" style={{ marginBottom: 16, gap: 4 }}>
            <AppText variant="small" color="textMuted">Latest observed move</AppText>
            <AppText variant="body" weight="700">
              {SECTIONS[displayBankEvents[0].section].title} {moveVerb(displayBankEvents[0].section, displayBankEvents[0].dir)}{' '}
              by an average {percentagePointLabel(displayBankEvents[0].avg_bps)} on {formatRunDate(displayBankEvents[0].date)}.
            </AppText>
          </Card>
        ) : null}

        <AppText variant="h3" style={{ marginBottom: 10 }}>Current products</AppText>
        {currentProducts}

        {showBankInsights && focusEvent && focusSection ? (
          <Card
            style={{ marginBottom: 16 }}
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${provider} move detail for ${formatRunDate(focusEvent.date)}`}
          >
            <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <AppText variant="h3">Move detail</AppText>
            </Row>
            <AppText variant="small" color="textMuted" style={{ marginBottom: 8 }}>
              {moveVerb(focusSection, focusEvent.dir)} {SECTIONS[focusSection].title.toLowerCase()} on{' '}
              {formatRunDate(focusEvent.date)}
              {focusRateCtx
                ? ` · median ${formatRate(focusRateCtx.before)} → ${formatRate(focusRateCtx.after)}`
                : ''}
            </AppText>
            <Row gap={8} style={{ marginBottom: 8, flexWrap: 'wrap' }}>
              <Chip
                label={`${focusEvent.moved} of ${focusEvent.total} products`}
                selected={false}
              />
              <Chip
                label={`avg ${bpsLabel(focusEvent.avg_bps)}`}
                selected
              />
            </Row>
            {focusedMoves.length ? (
              <>
                <AppText variant="small" weight="700" style={{ marginBottom: 2 }}>
                  Products that moved
                </AppText>
                <AppText variant="tiny" color="textFaint" style={{ marginBottom: 4 }}>
                  Tap a product to open its rate history
                </AppText>
                {focusedMoves.map((move, i) => (
                  <React.Fragment key={move.productKey}>
                    {i > 0 ? <Divider /> : null}
                    <ProductMoveRow move={move} section={focusSection} />
                  </React.Fragment>
                ))}
                <AppText variant="tiny" color="textFaint" style={{ marginTop: 6 }}>
                  {focusedMoves.length === focusEvent.moved
                    ? `All ${focusEvent.moved} moved products identified from available daily history.`
                    : `${focusedMoves.length} of ${focusEvent.moved} moved products identified from available daily history.`}
                </AppText>
              </>
            ) : (
              <AppText variant="small" color="textMuted">
                {productHistory
                  ? 'Could not match individual products for this move yet — try again after daily history finishes syncing.'
                  : productHistoryError
                    ? 'Product-level history is unavailable right now — pull to refresh and try again.'
                    : 'Loading product-level history to identify which accounts moved…'}
              </AppText>
            )}
          </Card>
        ) : null}

        {showBankInsights && focusSourceEvent && focusSection && !focusEvent ? (
          <Card style={{ marginBottom: 16 }} accessibilityLiveRegion="polite">
            <AppText variant="h3" style={{ marginBottom: 6 }}>
              Move detail
            </AppText>
            <AppText variant="small" color="textMuted" style={{ marginBottom: 8 }}>
              {SECTIONS[focusSection].title} · {formatRunDate(focusSourceEvent.date)}
            </AppText>
            <AppText variant="small" color="textMuted">
              {productHistoryError && focusHistoryState === 'loading'
                ? 'Product-level history is unavailable right now — try this move again shortly.'
                : focusHistoryState === 'loading'
                  ? 'Loading product-level history to identify which accounts moved…'
                  : focusHistoryState === 'unsafe'
                    ? 'Available history cannot safely identify this selected rate row, so no product is attributed.'
                    : focusHistoryState === 'incomplete'
                      ? 'Available history does not yet cover this move with a prior product observation.'
                      : 'None of the exactly matched products in your current settings comprised this move.'}
            </AppText>
          </Card>
        ) : null}

        {showBankInsights && recentMoveBreakdowns.length ? (
          <Card style={{ marginBottom: 16 }}>
            <AppText variant="h3" style={{ marginBottom: 4 }}>
              Products that changed
            </AppText>
            <AppText variant="tiny" color="textFaint" style={{ marginBottom: 8 }}>
              Exact product matches from available history
            </AppText>
            {recentMoveBreakdowns.map(({ event, moves }, bi) => (
              <View
                key={`${event.date}-${event.section}`}
                style={{ marginBottom: bi < recentMoveBreakdowns.length - 1 ? 12 : 0 }}
              >
                <AppText variant="small" weight="700" style={{ marginBottom: 2 }}>
                  {formatRunDate(event.date)} · {SECTIONS[event.section].short} · {event.moved} of{' '}
                  {event.total}
                </AppText>
                {moves.slice(0, 5).map((move, i) => (
                  <React.Fragment key={move.productKey}>
                    {i > 0 ? <Divider /> : null}
                    <ProductMoveRow move={move} section={event.section} />
                  </React.Fragment>
                ))}
                {moves.length > 5 ? (
                  <AppText variant="tiny" color="textFaint" style={{ marginTop: 4 }}>
                    +{moves.length - 5} more products
                  </AppText>
                ) : null}
              </View>
            ))}
          </Card>
        ) : null}

        {showBankInsights ? (
          chartModel && activeChartSection ? (
            <Card style={{ marginBottom: 16 }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <AppText variant="h3">Rate history</AppText>
              </Row>
              {chartSections.length > 1 ? (
                <SegmentedControl
                  options={chartSections.map((s) => ({ value: s, label: SECTIONS[s].short }))}
                  value={activeChartSection}
                  onChange={setChartSection}
                />
              ) : null}
              <AppText variant="tiny" color="textFaint" style={{ marginTop: 6, marginBottom: 4 }}>
                Band spans this lender&apos;s sharpest offer to its typical rate
              </AppText>
              <ChartErrorBoundary name="BankTrendChart">
                <BankHistoryChart
                  auditActionsRef={historyAuditActionsRef}
                  contentRevision={historyContentRevision}
                  dates={chartModel.dates}
                  points={chartModel.points}
                  allDates={chartModel.allDates}
                  rba={core.rba}
                  rbaHolds={core.rba_holds}
                  section={activeChartSection}
                  height={200}
                  onGraphicReady={onHistoryGraphicReady}
                />
              </ChartErrorBoundary>
              {rawBankEvents.length ? (
                <>
                  <Divider style={{ marginVertical: 10 }} />
                  <AppText variant="small" weight="700" style={{ marginBottom: 2 }}>
                    Recent moves
                  </AppText>
                  <AppText variant="tiny" color="textFaint" style={{ marginBottom: 4 }}>
                    {productHistory
                      ? 'Counts reflect exact product matches under your settings.'
                      : 'Moves shown match the lender sections available under your settings.'}
                  </AppText>
                  {displayBankEvents.length ? (
                    displayBankEvents.map((event) => (
                      <BankMoveRow
                        key={`${event.date}-${event.section}`}
                        event={event}
                        rateContext={bankEventContexts.get(`${event.date}:${event.section}`) ?? null}
                        focused={
                          !!focusEvent &&
                          event.date === focusEvent.date &&
                          event.section === focusEvent.section
                        }
                        showProductHint
                        onSelect={handleMoveSelect}
                      />
                    ))
                  ) : (
                    <AppText variant="small" color="textMuted" style={{ paddingVertical: 8 }}>
                      No recent changes could be exactly matched to products in your settings.
                    </AppText>
                  )}
                </>
              ) : null}
            </Card>
          ) : null
        ) : null}

      </ScreenScrollView>
    </>
  );
}
