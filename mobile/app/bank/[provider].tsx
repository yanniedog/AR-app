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
  recentBankEvents,
  type BankEventRateContext,
  type BankRateEvent,
} from '../../src/data/bankInsights';
import { formatRate, formatRunDate, visibleAccountRows } from '../../src/data/format';
import {
  productMovesForCatalog,
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
import type { RateRow, SectionKey } from '../../src/types';
import { SECTION_KEYS } from '../../src/types';
import { useTheme } from '../../src/theme/ThemeProvider';

function bpsLabel(bps: number): string {
  const rounded = Math.round(bps * 10) / 10;
  return `${rounded > 0 ? '+' : rounded < 0 ? '−' : ''}${Math.abs(rounded)} bps`;
}

function isSectionKey(value: string | undefined): value is SectionKey {
  return !!value && (SECTION_KEYS as readonly string[]).includes(value);
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

  useEffect(() => {
    const key = showBankInsights ? core?.run_date ?? null : null;
    if (!key || insightsRequestKey.current === key) return;
    insightsRequestKey.current = key;
    void ensureBankInsights();
  }, [core?.run_date, ensureBankInsights, showBankInsights]);

  useEffect(() => {
    // Product-level move drill-down needs the on-device product history ledger.
    // Do NOT pull history_banks here — bank trend charts use bankInsights only.
    // Defer until after navigation/interactions so the bank page paints instantly.
    if (!showBankInsights || !focusDate || !focusSection) {
      historyRequestKey.current = null;
      setProductHistoryReady(false);
      return;
    }
    const key = core?.run_date ?? null;
    if (!key) return;
    if (isPerformanceAuditActive()) {
      setProductHistoryReady(true);
      if (historyRequestKey.current !== key) {
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
        if (historyRequestKey.current === key) return;
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
    // Must match bank-insights event scope (unfiltered provider/section products).
    // Building from `bySection` would omit non-standard / token-rate products that
    // still contribute to headline moved/total counts when Standard-only is on.
    const out: Partial<Record<SectionKey, ProductMoveCatalogEntry[]>> = {};
    if (!core) return out;
    for (const section of SECTION_ORDER) {
      const catalog: ProductMoveCatalogEntry[] = [];
      const seen = new Set<string>();
      for (const row of core.sections[section]?.rates ?? []) {
        if (row.provider !== provider || !row.product_key || seen.has(row.product_key)) continue;
        seen.add(row.product_key);
        catalog.push({
          productKey: row.product_key,
          productName: (row.product_name && row.product_name.trim()) || row.product_key,
          rateIndex: typeof row.rate_index === 'number' ? row.rate_index : null,
        });
      }
      if (catalog.length) out[section] = catalog;
    }
    return out;
  }, [core, provider]);

  const chartSections = useMemo(
    () =>
      SECTION_ORDER.filter((section) => !!bankInsights?.banks?.[provider]?.[section]),
    [bankInsights, provider],
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
        ? bankTrendChartModel(bankInsights, provider, activeChartSection)
        : null,
    [activeChartSection, bankInsights, provider],
  );
  const bankEvents = useMemo(
    () => recentBankEvents(bankInsights, { provider, limit: 8 }),
    [bankInsights, provider],
  );

  const bankEventContexts = useMemo(() => {
    const map = new Map<string, BankEventRateContext | null>();
    for (const event of bankEvents) {
      map.set(`${event.date}:${event.section}`, bankEventMedianContext(bankInsights, event));
    }
    return map;
  }, [bankEvents, bankInsights]);

  const focusEvent: BankRateEvent | null = useMemo(() => {
    if (!focusDate || !focusSection) return null;
    return (
      bankEvents.find((e) => e.date === focusDate && e.section === focusSection) ??
      recentBankEvents(bankInsights, { provider }).find(
        (e) => e.date === focusDate && e.section === focusSection,
      ) ??
      null
    );
  }, [bankEvents, bankInsights, focusDate, focusSection, provider]);

  const focusRateCtx = useMemo(
    () => (focusEvent ? bankEventMedianContext(bankInsights, focusEvent) : null),
    [bankInsights, focusEvent],
  );

  const focusedMoves = useMemo(() => {
    if (!focusDate || !focusSection || !productHistory) return [] as ProductRateMove[];
    return productMovesForCatalog(productHistory, catalogsBySection[focusSection] ?? [], {
      date: focusDate,
    });
  }, [catalogsBySection, focusDate, focusSection, productHistory]);

  // Defer unfocused "Products involved" diffs until after paint — never on the
  // critical path of opening the bank page or landing productHistory in the store.
  const [recentMoveBreakdowns, setRecentMoveBreakdowns] = useState<
    { event: BankRateEvent; moves: ProductRateMove[] }[]
  >([]);
  useEffect(() => {
    if (focusEvent || !productHistory || !bankEvents.length) {
      setRecentMoveBreakdowns([]);
      return;
    }
    let cancelled = false;
    void yieldToUi().then(() => {
      if (cancelled) return;
      const out: { event: BankRateEvent; moves: ProductRateMove[] }[] = [];
      for (const event of bankEvents.slice(0, 3)) {
        const moves = productMovesForCatalog(productHistory, catalogsBySection[event.section] ?? [], {
          date: event.date,
        });
        if (moves.length) out.push({ event, moves });
      }
      if (!cancelled) setRecentMoveBreakdowns(out);
    });
    return () => {
      cancelled = true;
    };
  }, [bankEvents, catalogsBySection, focusEvent, productHistory]);

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
      actions['lender.history.window.next'] = () =>
        historyAuditActionsRef.current?.selectNextWindow();
      actions['lender.history.date.previous'] = () =>
        historyAuditActionsRef.current?.selectPreviousDate();
    }
    if (bankEvents[0]) {
      actions['lender.move.first'] = () => {
        handleMoveSelect(bankEvents[0]);
        return { expectedPath: `/bank/${encodeURIComponent(provider)}` };
      };
    }
    return actions;
  }, [activeChartSection, bankEvents, chartModel, chartSections, core, handleMoveSelect, provider]);
  const lenderLogoIds = useMemo(
    () => provider ? [`lender:header:${provider}`] : [],
    [provider],
  );
  const logoReadiness = useLogoReadiness(provider, lenderLogoIds);
  usePerformanceAuditSurface({
    id: 'lender.details',
    routeKey: '/bank/[provider]',
    datasetRevision: core?.run_date ?? null,
    renderRevision: `${provider}:${productCount}:${activeChartSection ?? 'none'}:${chartModel?.dates.length ?? 0}`,
    actions: auditActions,
    probes: [
      {
        id: 'lender.data',
        kind: 'data',
        status: core ? 'ready' : 'pending',
        datasetRevision: core?.run_date ?? null,
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
      },
      {
        id: 'lender.logo',
        kind: 'logo',
        status: provider && logoReadiness.ready ? 'ready' : 'pending',
        expectedCount: logoReadiness.expectedCount,
        actualCount: logoReadiness.terminalCount,
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
        status: showBankInsights && bankInsights && !chartModel ? 'pending' : 'ready',
        actualCount: chartModel?.dates.length ?? 0,
      },
      {
        id: 'lender.product-history-data',
        kind: 'data',
        required: !!focusEvent,
        status: !focusEvent || productHistory
          ? 'ready'
          : productHistoryError
            ? 'error'
            : 'pending',
        error: focusEvent ? productHistoryError : null,
        expectedCount: focusEvent ? 1 : 0,
        actualCount: focusEvent && productHistory ? 1 : 0,
      },
    ],
  });

  if (!core) return <ScreenSkeleton />;

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
              {productCount} products
            </AppText>
          </View>
        </Row>

        {showBankInsights && focusEvent && focusSection ? (
          <Card
            style={{ marginBottom: 16 }}
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${provider} move detail for ${formatRunDate(focusEvent.date)}`}
          >
            <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <AppText variant="h3">Move detail</AppText>
              <Chip label="PRO" selected />
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

        {showBankInsights ? (
          chartModel && activeChartSection ? (
            <Card style={{ marginBottom: 16 }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                <AppText variant="h3">Rate history</AppText>
                <Chip label="PRO" selected />
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
                  dates={chartModel.dates}
                  points={chartModel.points}
                  allDates={chartModel.allDates}
                  rba={core.rba}
                  rbaHolds={core.rba_holds}
                  section={activeChartSection}
                  height={200}
                />
              </ChartErrorBoundary>
              {bankEvents.length ? (
                <>
                  <Divider style={{ marginVertical: 10 }} />
                  <AppText variant="small" weight="700" style={{ marginBottom: 2 }}>
                    Recent moves
                  </AppText>
                  {bankEvents.map((event) => (
                    <BankMoveRow
                      key={`${event.date}-${event.section}`}
                      event={event}
                      rateContext={bankEventContexts.get(`${event.date}:${event.section}`) ?? null}
                      focused={
                        !!focusEvent &&
                        event.date === focusEvent.date &&
                        event.section === focusEvent.section
                      }
                      onSelect={handleMoveSelect}
                    />
                  ))}
                </>
              ) : null}
            </Card>
          ) : null
        ) : null}

        {showBankInsights && !focusEvent && recentMoveBreakdowns.length ? (
          <Card style={{ marginBottom: 16 }}>
            <AppText variant="h3" style={{ marginBottom: 4 }}>
              Products involved
            </AppText>
            <AppText variant="tiny" color="textFaint" style={{ marginBottom: 8 }}>
              Which accounts drove the latest detected moves
            </AppText>
            {recentMoveBreakdowns.map(({ event, moves }, bi) => (
              <View key={`${event.date}-${event.section}`} style={{ marginBottom: bi < recentMoveBreakdowns.length - 1 ? 12 : 0 }}>
                <AppText variant="small" weight="700" style={{ marginBottom: 2 }}>
                  {formatRunDate(event.date)} · {SECTIONS[event.section].short} · avg{' '}
                  {bpsLabel(event.avg_bps)}
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

        {bySection.length === 0 ? (
          <EmptyState title="No products" subtitle="This lender has no rates in the current data set." />
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
                  logoRenderStateId={`lender:${section}:${r.rate_index ?? 'default'}#${r.product_key}`}
                  onLogoRenderStateChange={logoReadiness.onLogoRenderStateChange}
                  onPress={() => openProduct(r.product_key, r.rate_index)}
                />
              ))}
            </View>
          ))
        )}
      </ScreenScrollView>
    </>
  );
}
