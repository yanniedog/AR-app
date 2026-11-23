import { uiCount, uiDate, uiJoin, uiLabel, uiNumber, uiProviderName, uiSectionName, type UiCopy, type UiText } from "../../src/lib/uiCopy";
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { FLASH_LIST_DRAW_DISTANCE } from '../../src/lib/flashListDefaults';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, ScrollView, useWindowDimensions, View } from 'react-native';

import { BankHistoryStatistics } from '../../src/components/BankHistoryStatistics';
import { ProviderRateFilters } from '../../src/components/ProviderRateFilters';
import { normalizeProfileFilters, profileFeaturesForSection, profileFilterRows, type ProfileFilters } from '../../src/data/profile';
import { providerRowIdentity, providerTierSeries } from '../../src/data/providerRateWorkspace';
import { uiProductName as selectedProductName } from '../../src/lib/uiCopy';
import { bankRateScope } from '../../src/data/bankRateOverview';
import { packedBankRateSnapshots } from '../../src/data/bankRateHistory';
import { BankAvatar } from '../../src/components/BankAvatar';
import {
  BankHistoryChart,
  type BankHistoryChartAuditActions,
} from '../../src/components/BankHistoryChart';
import { ChartErrorBoundary } from '../../src/components/ChartErrorBoundary';
import { EmptyState, ScreenSkeleton } from '../../src/components/feedback';
import { ProductCard } from '../../src/components/ProductCard';
import { DataHealthBannerStrip, responsiveScreenContentStyle, Screen } from '../../src/components/Screen';
import { SegmentedControl } from '../../src/components/controls';
import { AppText, Button, Card, Chip, Row } from '../../src/components/ui';
import { SECTION_ORDER } from '../../src/constants';
import {
  bankEventMedianContext,
  filterBankInsightsForSuitability,
  filterBankInsightsForSuitabilityCooperatively,
  recentBankEvents,
  type BankRateEvent,
} from '../../src/data/bankInsights';
import { formatRate } from '../../src/data/format';
import {
  productHistoryRepresentsRateRow,
  productMoveBreakdownForCatalog,
  type ProductMoveCatalogEntry,
  type ProductRateMove,
} from '../../src/data/productHistory';
import { lenderProductRows } from '../../src/data/selectors';
import { hasRateHistoryChartSection, rateHistoryChartModel } from '../../src/data/rateHistoryCharts';
import { stableRowsForProvider } from '../../src/data/rateRowIndex';
import { useStore } from '../../src/data/store';
import { usePerformanceAuditSurface } from '../../src/hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../../src/hooks/useLogoReadiness';
import { useVirtualizedListReadiness } from '../../src/hooks/useVirtualizedListReadiness';
import { nextListIdentityVersion, type ListIdentityVersion } from '../../src/lib/virtualizedListReadiness';
import { openProduct } from '../../src/lib/nav';
import {
  auditActionInteger,
  auditActionString,
} from '../../src/lib/performanceAuditActionParams';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import { useBankRateHistory } from '../../src/hooks/useBankRateHistory';
import { useDeferredHistorySurface } from '../../src/hooks/useDeferredHistorySurface';
import { effectiveBankInsights } from '../../src/lib/proAccess';
import { yieldToUi } from '../../src/lib/yieldToUi';
import {
  isCurrentHistoryGraphicEvidence,
  isMeasuredEmptyHistoryGraphic,
  type HistoryGraphicEvidence,
} from '../../src/lib/historyGraphicEvidence';
import type { BankHistoryPoint, RateRow, SectionKey } from '../../src/types';
import { SECTION_KEYS } from '../../src/types';
const providerSessions = new Map<string, { profile: ProfileFilters; view: 'carousel' | 'list'; selected: string | null; offset: number }>();
interface LenderProductItem { row: RateRow; section: SectionKey; firstInSection: boolean; id: string }

const LenderProductRow = React.memo(function LenderProductRow({ item, selected, onSelect }: {
  item: LenderProductItem; selected: boolean; onSelect: (id: string) => void;
}) {
  const onPress = useCallback(() => item.row.public_programme_id
    ? openProduct(item.row.product_key, item.row.rate_index, item.row.public_programme_id)
    : openProduct(item.row.product_key, item.row.rate_index), [item.row]);
  return <View>
    {item.firstInSection ? <AppText variant="small" weight="700" color="textMuted" style={{ marginBottom: 8, marginLeft: 4 }}>
      {uiSectionName(item.section)}
    </AppText> : null}
    <ProductCard
      row={item.row}
      section={item.section}
      showLenderAction={false}
      selected={selected}
      onPress={() => onSelect(item.id)}
    />
    {selected ? <Button title="Product details" variant="secondary" onPress={onPress} /> : null}
  </View>;
});

function bpsLabel(bps: number): UiText {
  const rounded = Math.round(bps * 10) / 10;
  return uiJoin(rounded>0?'+':rounded<0?'−':'',uiNumber(Math.abs(rounded),1),' ','bps');
}


/** Saved-profile dimensions apply to every section but only Mortgage has controls here. */
function sectionFiltered(p: ProfileFilters, section: SectionKey): boolean {
  return profileFeaturesForSection(p, section).length > 0
    || (section === 'Savings' && p.depositKinds.length > 0) || (section === 'TD' && p.interestPayments.length > 0);
}
function clearSectionFilters(p: ProfileFilters, section: SectionKey): ProfileFilters {
  const features = new Set(profileFeaturesForSection(p, section));
  return { ...p, accountFeatures: p.accountFeatures.filter(feature => !features.has(feature)),
    depositKinds: section === 'Savings' ? [] : p.depositKinds, interestPayments: section === 'TD' ? [] : p.interestPayments };
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


export default function BankDetail() {
  // Already decoded by expo-router — decoding again would throw on a literal '%'.
  const {
    provider: raw,
    date: focusDateRaw,
    section: focusSectionRaw,
  } = useLocalSearchParams<{ provider: string; date?: string; section?: string }>();
  const provider = raw ?? '';
  const focusDate = typeof focusDateRaw === 'string' ? focusDateRaw.slice(0, 10) : '';
  const focusSectionParam=Array.isArray(focusSectionRaw)?focusSectionRaw[0]:focusSectionRaw;
  const focusSection=isSectionKey(focusSectionParam)?focusSectionParam:null;

  const router = useRouter();
  const core = useStore((s) => s.core);
  const coreIntegrity = useStore((s) => s.coreIntegrity);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? null);
  const bankInsightsSha = useStore((s) => s.manifest?.files.bank_history?.sha256 ?? null);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const showBankInsights = effectiveBankInsights();
  // Keep rich history prep + BankHistoryChart off the synchronous lender mount
  // that product.lender.open measures as actionMs / event-loop lag.
  const historySurfaceReady = useDeferredHistorySurface(provider);
  const savedProfile = useStore(s => s.prefs.profileFilters);
  const [providerProfile, setProviderProfile] = useState(() => providerSessions.get(provider)?.profile ?? normalizeProfileFilters(savedProfile));
  const [productView, setProductView] = useState<'carousel' | 'list'>(() => providerSessions.get(provider)?.view ?? 'list');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(() => providerSessions.get(provider)?.selected ?? null);
  const listOffset = useRef(providerSessions.get(provider)?.offset ?? 0);
  useEffect(() => {
    providerSessions.set(provider, { profile: providerProfile, view: productView, selected: selectedProduct, offset: listOffset.current });
    if (providerSessions.size > 32) providerSessions.delete(providerSessions.keys().next().value!);
  }, [provider, providerProfile, productView, selectedProduct]);
  const rateHistory = useBankRateHistory(showBankInsights && historySurfaceReady, undefined, providerProfile);
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
  const hasProductHistory = productHistory != null;
  const insightsRequestKey = useRef<string | null>(null);
  const historyRequestKey = useRef<string | null>(null);
  const scrollRef = useRef<FlashListRef<LenderProductItem>>(null);
  const insets = useSafeAreaInsets();
  const { width, height: screenHeight, fontScale } = useWindowDimensions();
  const [contentWidth, setContentWidth] = useState(width);
  const [contentHeight, setContentHeight] = useState(Math.max(320, screenHeight - 160));
  const chartHeight = fontScale >= 1.2 || screenHeight < 700 ? 100 : 145;
  const [statisticsHeight, setStatisticsHeight] = useState(80);
  const [browseControlsHeight, setBrowseControlsHeight] = useState(56);
  const [carouselNavigationHeight, setCarouselNavigationHeight] = useState(64);
  const [moveDetailHeight, setMoveDetailHeight] = useState(0);
  const productMinimumHeight = fontScale >= 1.2 ? 180 : 150;
  const cardWidth = Math.max(160, contentWidth - 32);
  const historyAuditActionsRef = useRef<BankHistoryChartAuditActions | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [historyGraphicEvidence, setHistoryGraphicEvidence] =
    useState<HistoryGraphicEvidence | null>(null);
  const lenderRow = useMemo(() => core ? SECTION_ORDER.map(section =>
    stableRowsForProvider(core.sections[section].rates, provider)[0]).find(row => row != null) : undefined,
  [core, provider]);

  const rawBankEvents = useMemo(
    () => recentBankEvents(bankInsights, { provider }),
    [bankInsights, provider],
  );

  useEffect(() => {
    if (!showBankInsights || !historySurfaceReady) return;
    const key = core?.run_date ?? null;
    if (!key || insightsRequestKey.current === key) return;
    insightsRequestKey.current = key;
    void ensureBankInsights();
  }, [core?.run_date, ensureBankInsights, historySurfaceReady, showBankInsights]);

  useEffect(() => {
    // Product-level move drill-down needs the on-device product history ledger.
    // Do NOT pull history_banks here — bank trend charts use bankInsights only.
    // Subscribe only after the deferred history surface is allowed, and only warm
    // the multi-day ledger after the user opens a dated move drill-down.
    // Never eager-subscribe during audit on ordinary lender.open — that pulled a
    // multi-MB ledger onto the measured open path.
    if (!showBankInsights || !historySurfaceReady) {
      historyRequestKey.current = null;
      setProductHistoryReady(false);
      return;
    }
    const key = core?.run_date ?? null;
    if (!key) return;
    const shouldFetch = !!(focusDate && focusSection);
    if (!shouldFetch) {
      historyRequestKey.current = null;
      // Moves list is optional; keep the ledger unsubscribed until drill-down.
      setProductHistoryReady(false);
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
    historySurfaceReady,
    showBankInsights,
  ]);

  const rateGroups = useCallback((allTiers: boolean) => {
    void suitabilityRevision;
    const out: { section: SectionKey; rows: RateRow[] }[] = [];
    if (!core) return out;
    for (const section of SECTION_ORDER) {
      // Stable input identity: the ranked list is cached per edition and lender,
      // so reopening a lender does not filter and rank its whole book again.
      const sectionRates = core.sections[section]?.rates;
      const rows = profileFilterRows(lenderProductRows(
        sectionRates ? stableRowsForProvider(sectionRates, provider) : [],
        section, depositRankMetric, mortgageRateMetric, includeNonStandard, detailsProducts, allTiers,
      ), providerProfile, section, detailsProducts);
      if (rows.length) out.push({ section, rows });
    }
    return out;
  }, [core, provider, depositRankMetric, mortgageRateMetric, includeNonStandard, detailsProducts, suitabilityRevision, providerProfile]);

  const catalogsBySection = useMemo(() => {
    // Keep event denominators and product names in the exact same scope as the
    // cards below, but only where the selected row is also the product-best
    // rate represented by the product-key history ledger. Withhold ambiguous
    // base/bonus or comparison-selected rows rather than misattribute a move.
    const out: Partial<Record<SectionKey, ProductMoveCatalogEntry[]>> = {};
    if (!showBankInsights || !hasProductHistory) return out;
    for (const { section, rows } of rateGroups(false)) {
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
  }, [rateGroups, core, hasProductHistory, showBankInsights]);

  const heavyHistory =
    (core?.sections.Mortgage.rates.length ?? 0) > 400 ||
    (core?.sections.Savings.rates.length ?? 0) > 400 ||
    (core?.sections.TD.rates.length ?? 0) > 400;
  const [deferredBankInsights, setDeferredBankInsights] = useState<{
    bankInsights: typeof bankInsights;
    core: typeof core;
    coreIntegrity: typeof coreIntegrity;
    detailsProducts: typeof detailsProducts;
    includeNonStandard: boolean;
    suitabilityRevision: number;
    insights: ReturnType<typeof filterBankInsightsForSuitability>;
  } | null>(null);
  const currentDeferredBankInsights =
    deferredBankInsights &&
    deferredBankInsights.bankInsights === bankInsights &&
    deferredBankInsights.core === core &&
    deferredBankInsights.coreIntegrity === coreIntegrity &&
    deferredBankInsights.detailsProducts === detailsProducts &&
    deferredBankInsights.includeNonStandard === includeNonStandard &&
    deferredBankInsights.suitabilityRevision === suitabilityRevision
      ? deferredBankInsights.insights
      : null;

  useEffect(() => {
    if (!heavyHistory || !historySurfaceReady || !showBankInsights || !bankInsights || !core) {
      setDeferredBankInsights(null);
      return;
    }
    let cancelled = false;
    setDeferredBankInsights(null);
    void filterBankInsightsForSuitabilityCooperatively(
      bankInsights,
      core,
      includeNonStandard,
      detailsProducts,
      suitabilityRevision,
      coreIntegrity,
      { cancelled: () => cancelled, yieldControl: () => yieldToUi(0) },
    ).then((insights) => {
      if (!cancelled) {
        setDeferredBankInsights({
          bankInsights,
          core,
          coreIntegrity,
          detailsProducts,
          includeNonStandard,
          suitabilityRevision,
          insights,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    bankInsights,
    core,
    coreIntegrity,
    detailsProducts,
    heavyHistory,
    historySurfaceReady,
    includeNonStandard,
    showBankInsights,
    suitabilityRevision,
  ]);

  const visibleBankInsights = useMemo(
    () =>
      !historySurfaceReady || !showBankInsights
        ? null
        : heavyHistory
          ? currentDeferredBankInsights
          : filterBankInsightsForSuitability(
              bankInsights,
              core,
              includeNonStandard,
              detailsProducts,
              suitabilityRevision,
              coreIntegrity,
            ),
    [
      bankInsights,
      core,
      coreIntegrity,
      currentDeferredBankInsights,
      detailsProducts,
      heavyHistory,
      historySurfaceReady,
      includeNonStandard,
      showBankInsights,
      suitabilityRevision,
    ],
  );

  const visibleBankEvents = useMemo(
    () => recentBankEvents(visibleBankInsights, { provider }),
    [provider, visibleBankInsights],
  );

  const chartSections = useMemo(() => {
    if (!core) return [] as SectionKey[];
    return SECTION_ORDER.filter((section) => {
      if (rateHistory.historyAvailable) {
        return !!core.sections[section].rates.some(row => row.provider === provider) || hasRateHistoryChartSection(rateHistory.snapshots, section, provider);
      }
      return !!core?.sections[section].rates.some(row => row.provider === provider);
    });
  }, [
    provider, rateHistory.historyAvailable, rateHistory.snapshots, core,
  ]);
  const [chartSection, setChartSection] = useState<SectionKey | null>(null);
  const activeChartSection =
    chartSection && chartSections.includes(chartSection)
      ? chartSection
      : focusSection && chartSections.includes(focusSection)
        ? focusSection
        : chartSections[0] ?? null;

  const chartModel = useMemo(() => {
    if (!historySurfaceReady || !activeChartSection || rateHistory.updating || rateHistory.failed) {
      return null;
    }
    return rateHistory.historyAvailable
      ? rateHistoryChartModel(rateHistory.snapshots, activeChartSection, provider)
      : core ? rateHistoryChartModel(packedBankRateSnapshots(core, bankRateScope(Object.fromEntries(
          SECTION_ORDER.map(section => [section, rateGroups(true).find(group => group.section === section)?.rows ?? []]),
        ) as Record<SectionKey, RateRow[]>)), activeChartSection, provider) : null;
  }, [
    activeChartSection,
    historySurfaceReady,
    provider,
    rateHistory.failed,
    rateHistory.historyAvailable,
    rateHistory.snapshots,
    rateHistory.updating,
    core, rateGroups,
  ]);
  const historyContentRevision = [
    rateHistory.revision,
    bankInsightsSha ?? 'no-bank-history-sha',
    provider,
    activeChartSection,
    chartModel?.dates.at(-1) ?? 'none',
    chartModel?.dates.length ?? 0,
  ].join(':');
  const [chartStatistics, setChartStatistics] = useState<{ revision: string; point: BankHistoryPoint | null } | null>(null);
  const onStatisticsChange = useCallback((point: BankHistoryPoint | null) => {
    setChartStatistics(current => current?.revision === historyContentRevision && current.point === point ? current : { revision: historyContentRevision, point });
  }, [historyContentRevision]);
  const selectedStatistics = chartStatistics?.revision === historyContentRevision ? chartStatistics.point : chartModel?.points.at(-1) ?? null;
  const onHistoryGraphicReady = useCallback((evidence: HistoryGraphicEvidence) => {
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

  const focusRateCtx = useMemo(
    () => (focusEvent ? bankEventMedianContext(visibleBankInsights, focusEvent) : null),
    [focusEvent, visibleBankInsights],
  );


  const allProductItems = useMemo(() => rateGroups(true).flatMap(({ section, rows }) => rows.map((row, index) => ({
    id: providerRowIdentity(section, row), row, section, firstInSection: index === 0,
  }))), [rateGroups]);
  const productItems = useMemo(() => activeChartSection ? allProductItems.filter(item => item.section === activeChartSection) : allProductItems,
    [allProductItems, activeChartSection]);
  const activeProduct = productItems.find(item => item.id === selectedProduct) ?? productItems[0];
  const selectedSeries = useMemo(() => core && activeProduct ? {
    values: providerTierSeries(core, activeProduct.row, activeProduct.section), label: selectedProductName(activeProduct.row),
  } : null, [core, activeProduct]);
  const mortgageFilterRows = useMemo(() => core ? stableRowsForProvider(core.sections.Mortgage.rates, provider) : [], [core, provider]);
  const productCount = productItems.length;
  const productListRevision = useRef<ListIdentityVersion | null>(null);
  productListRevision.current = nextListIdentityVersion(productListRevision.current, productItems.map(item => item.id));
  const listVersion = productListRevision.current.version;
  const seenListVersion = useRef(listVersion);
  // A different set of rows is a new list, so it starts at the top, not at the old scroll offset.
  if (seenListVersion.current !== listVersion) { seenListVersion.current = listVersion; listOffset.current = 0; const session = providerSessions.get(provider); if (session) session.offset = 0; }
  const listRevision = `${provider}:${coreSha ?? core?.run_date ?? ''}:${listVersion}`;
  const listReadiness = useVirtualizedListReadiness(listRevision, productCount);

  const handleMoveSelect = useCallback(
    (event: BankRateEvent) => {
      router.setParams({ date: event.date, section: event.section });
      if (productView === 'list') requestAnimationFrame(() => scrollRef.current?.scrollToOffset({ offset: 0, animated: true }));
    },
    [productView, router],
  );
  const auditActions = useMemo(() => {
    const actions: Record<string, (...args: unknown[]) => unknown> = {
      // Do not claim product.lender.open here — a stale mounted lender surface
      // would no-op the product-page action and abort the deep audit.
      'lender.product.first': (...args: unknown[]) => {
        const productKey = auditActionString(args, 'productKey');
        const rateIndex = auditActionInteger(args, 'rateIndex');
        const plannedSection = auditActionString(args, 'section');
        const programmeId = auditActionString(args, 'programmeId');
        const exact = productItems.find(({ row, section }) => row.product_key === productKey &&
          (plannedSection == null || section === plannedSection) &&
          (rateIndex == null || row.rate_index === rateIndex) &&
          (row.public_programme_id || null) === programmeId);
        if (!exact) return { unavailableReason: 'The exact planned lender product is not rendered' };
        if (exact.row.public_programme_id) openProduct(exact.row.product_key, exact.row.rate_index, exact.row.public_programme_id);
        else openProduct(exact.row.product_key, exact.row.rate_index);
        return { expectedPath: `/product/${encodeURIComponent(exact.row.product_key)}`,
          section: exact.section, productKey: exact.row.product_key, rateIndex: exact.row.rate_index ?? null };
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
  }, [activeChartSection, bankEvents, chartModel, chartSections, handleMoveSelect, productItems, provider, visibleBankEvents]);
  const lenderLogoIds = useMemo(
    () => provider ? [`lender:header:${provider}`] : [],
    [provider],
  );
  // Only the header avatar participates in lender.logo readiness. Wiring every
  // product-card avatar into the probe made expectedCount track the viewport
  // (audit saw 25+) and kept open settle waiting on recycled list logos.
  const logoReadiness = useLogoReadiness(listRevision, lenderLogoIds);
  const renderProductItem = useCallback(({ item }: { item: LenderProductItem }) => (
    <View style={productView === 'carousel' ? { width: cardWidth, paddingRight: 12 } : undefined}><LenderProductRow item={item} selected={activeProduct?.id === item.id} onSelect={setSelectedProduct} /></View>
  ), [activeProduct?.id, productView, cardWidth]);
  const moveHistoryRequired = showBankInsights && historySurfaceReady && !!(focusDate && focusSection);
  const currentHistoryGraphicEvidence = isCurrentHistoryGraphicEvidence(
    historyGraphicEvidence,
    historyContentRevision,
  ) ? historyGraphicEvidence : null;
  usePerformanceAuditSurface({
    id: 'lender.details',
    routeKey: '/bank/[provider]',
    datasetRevision: coreSha ?? core?.run_date ?? null,
    // Omit deferred history/chart identity until the surface is allowed so open
    // readiness can quiet without waiting on graphic work.
    renderRevision: historySurfaceReady
      ? `${provider}:${productCount}:${historyContentRevision}:${currentHistoryGraphicEvidence?.graphicRevision ?? 'graphic-pending'}:${focusHistoryState}:${productHistory ? `moves-${bankEvents.length}` : 'moves-on-demand'}`
      : `${provider}:${productCount}:history-deferred`,
    actions: auditActions,
    probes: [
      {
        id: 'lender.data',
        kind: 'data',
        status: core ? 'ready' : 'pending',
        datasetRevision: coreSha ?? core?.run_date ?? null,
        expectedCount: productCount,
        actualCount: core ? productCount : 0,
      },
      {
        id: 'lender.products',
        kind: 'list',
        status: core && listReadiness.visiblyCommitted ? 'ready' : 'pending',
        expectedCount: productCount,
        actualCount: listReadiness.committedItemCount,
        visibleCount: listReadiness.measuredVisibleCount,
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
        status: !historySurfaceReady
          ? 'ready'
          : rateHistory.failed
            ? 'error'
            : rateHistory.updating || (showBankInsights && !rateHistory.historyAvailable && !bankInsights)
              ? 'pending'
              : 'ready',
        error: rateHistory.failed ? 'Historical rates could not be prepared' : null,
        expectedCount: !historySurfaceReady ? 0 : rateHistory.failed ? Math.max(1, chartModel?.dates.length ?? 0) : (chartModel?.dates.length ?? 0),
        actualCount: !historySurfaceReady || rateHistory.failed ? 0 : (chartModel?.dates.length ?? 0),
      },
      {
        id: 'lender.history-graphic',
        kind: 'graphic',
        required: false,
        status: !historySurfaceReady
          ? 'ready'
          : rateHistory.failed
            ? 'error'
            : rateHistory.updating
              ? 'pending'
              : !chartModel
                ? 'ready'
                : !currentHistoryGraphicEvidence
                  ? 'pending'
                  : currentHistoryGraphicEvidence.availability === 'rendered' ||
                    isMeasuredEmptyHistoryGraphic(currentHistoryGraphicEvidence)
                    ? 'ready'
                    : 'error',
        error: rateHistory.failed ? 'Historical rates could not be prepared'
          : currentHistoryGraphicEvidence?.availability === 'unavailable' &&
            !isMeasuredEmptyHistoryGraphic(currentHistoryGraphicEvidence)
          ? 'Lender history has no finite values to plot'
          : null,
        expectedCount: currentHistoryGraphicEvidence?.expectedCount ?? 0,
        actualCount: currentHistoryGraphicEvidence?.pointCount ?? 0,
        accessibleSummary: currentHistoryGraphicEvidence?.accessibleSummary ?? false,
        layoutMeasured: currentHistoryGraphicEvidence?.layoutMeasured ?? false,
        emptyStateRendered: currentHistoryGraphicEvidence?.emptyStateRendered ?? false,
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
  const lenderName=lenderRow?uiProviderName(lenderRow):uiLabel('Bank');
  const direction=(value:BankRateEvent['dir']):UiCopy=>value==='hike'?'Increase':value==='cut'?'Decrease':'Mixed';
  const moveDetail = <>
        {showBankInsights && historySurfaceReady && focusEvent && focusSection ? (
          <Card
            style={{ marginBottom: 16 }}
            accessibilityLiveRegion="polite"
            accessibilityLabel={uiJoin(lenderName,' · ','Move detail',' · ',uiDate(focusEvent.date))}
          >
            <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <AppText variant="h3">{uiLabel("Move detail")}</AppText>
            </Row>
            <AppText variant="small" color="textMuted" style={{ marginBottom: 8 }}>
              {uiJoin(direction(focusEvent.dir),' · ',uiSectionName(focusSection),' · ',uiDate(focusEvent.date),focusRateCtx?uiJoin(' · ','Median',': ',formatRate(focusRateCtx.before),' → ',formatRate(focusRateCtx.after)):null)}
            </AppText>
            <Row gap={8} style={{ marginBottom: 8, flexWrap: 'wrap' }}>
              <Chip
                label={uiJoin(uiCount(focusEvent.moved),' / ',uiCount(focusEvent.total),' ','Products')}
                selected={false}
              />
              <Chip
                label={uiJoin('Average',': ',bpsLabel(focusEvent.avg_bps))}
                selected
              />
            </Row>
            {!focusedMoves.length ? <AppText variant="small" color="textMuted">
              {uiLabel(productHistory ? 'No exact matches' : productHistoryError ? 'History unavailable' : 'Loading')}
            </AppText> : null}
          </Card>
        ) : null}

        {showBankInsights && historySurfaceReady && focusSourceEvent && focusSection && !focusEvent ? (
          <Card style={{ marginBottom: 16 }} accessibilityLiveRegion="polite">
            <AppText variant="h3" style={{ marginBottom: 6 }}>{uiLabel("Move detail")}</AppText>
            <AppText variant="small" color="textMuted" style={{ marginBottom: 8 }}>
              {uiJoin(uiSectionName(focusSection),' · ',uiDate(focusSourceEvent.date))}
            </AppText>
            <AppText variant="small" color="textMuted">
              {uiLabel(productHistoryError && focusHistoryState === 'loading' ? 'History unavailable':focusHistoryState === 'loading' ? 'Loading':focusHistoryState === 'unsafe' ? 'Exact rate attribution unsafe':focusHistoryState === 'incomplete' ? 'Prior observation missing':'No exact compatible matches')}
            </AppText>
          </Card>
        ) : null}
  </>;
  const moveDetailShown = productView === 'carousel' && showBankInsights && historySurfaceReady && !!focusSection && !!focusSourceEvent;
  const chartViewportHeight = Math.max(100, Math.min(contentHeight * 0.55,
    contentHeight - statisticsHeight - browseControlsHeight - (productView === 'carousel' ? carouselNavigationHeight : 0) - (moveDetailShown ? moveDetailHeight : 0) - productMinimumHeight));


  const chartContent = <>
          <DataHealthBannerStrip />
          <Row gap={8} style={{ marginVertical: 6 }}>
            <BankAvatar provider={provider} size={28} renderStateId={lenderLogoIds[0]}
              onRenderStateChange={logoReadiness.onLogoRenderStateChange} />
            <AppText variant="small" weight="700">{uiJoin("Rate history", " \u00b7 ", "Advertised")}</AppText>
          </Row>
              {chartSections.length > 1 ? (
                <SegmentedControl
                  options={chartSections.map((s) => ({ value: s, label: uiSectionName(s,true) }))}
                  value={activeChartSection}
                  onChange={setChartSection}
                />
              ) : null}
        {showBankInsights && historySurfaceReady && (rateHistory.updating || rateHistory.failed) ? (
          <Card style={{ marginBottom: 6 }}>
            <AppText variant="h3">{uiLabel("Rate history")}</AppText>
            <AppText variant="small" color="textMuted" accessibilityRole="alert">
              {uiLabel(rateHistory.failed ? 'History unavailable':'Loading')}
            </AppText>
          </Card>
        ) : null}
        {showBankInsights && historySurfaceReady ? (
          chartModel && activeChartSection ? (
            <View style={{ marginBottom: 6 }}>
              <ChartErrorBoundary name="BankTrendChart">
                <BankHistoryChart
                  key={`${provider}:${activeChartSection}`}
                  auditActionsRef={historyAuditActionsRef}
                  contentRevision={historyContentRevision}
                  dates={chartModel.dates}
                  points={chartModel.points}
                  allDates={chartModel.allDates}
                  rba={core.rba}
                  rbaHolds={core.rba_holds}
                  section={activeChartSection}
                  height={chartHeight}
                  compactStatistics
                  statisticsInline={false}
                  onStatisticsChange={onStatisticsChange}
                  stateKey={`${provider}:${activeChartSection}`}
                  windowMemory="lender"
                  highlightSeries={selectedSeries}
                  onGraphicReady={onHistoryGraphicReady}
                />
              </ChartErrorBoundary>
            </View>
          ) : !rateHistory.updating && !rateHistory.failed ? <View style={{ height: chartHeight, justifyContent: 'center' }}>
            <AppText variant="small" color="textMuted">{uiLabel('No observations')}</AppText>
          </View> : null
        ) : null}
  </>;
  const statisticsAndControls = <>
        {activeChartSection ? <BankHistoryStatistics point={chartModel ? selectedStatistics : null} section={activeChartSection}
          onLayout={event => setStatisticsHeight(event.nativeEvent.layout.height)} /> : null}
          <Row testID="provider-browse-controls" onLayout={event => setBrowseControlsHeight(event.nativeEvent.layout.height)} gap={8} style={{ flexShrink: 0, paddingVertical: 4, paddingHorizontal: 16 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              {activeChartSection === 'Mortgage' ? <ProviderRateFilters rows={mortgageFilterRows} profile={providerProfile} onChange={setProviderProfile} />
                : <Row gap={8}>
                  <AppText variant="tiny">{uiJoin(uiCount(productCount), ' ', 'Products')}</AppText>
                  {activeChartSection && sectionFiltered(providerProfile, activeChartSection)
                    ? <Chip label="Clear filters" selected onPress={() => setProviderProfile(clearSectionFilters(providerProfile, activeChartSection))} /> : null}
                </Row>}
            </View>
            <Chip label={productView === 'carousel' ? 'List' : 'Carousel'} onPress={() => setProductView(productView === 'carousel' ? 'list' : 'carousel')} />
          </Row>
  </>;

  return (
    <>
      <Stack.Screen options={{ title: lenderName }} />
      <Screen showDataHealthBanner={false}>
        <View style={{ ...responsiveScreenContentStyle(width), paddingHorizontal: 0, flex: 1 }} onLayout={event => { setContentWidth(event.nativeEvent.layout.width); setContentHeight(event.nativeEvent.layout.height); }}>
        {productView === 'carousel' ? <>
        <ScrollView testID="provider-chart-viewport" style={{ flexGrow: 0, flexShrink: 0, height: chartViewportHeight }}
          contentContainerStyle={{ paddingHorizontal: 16 }} nestedScrollEnabled>
          {chartContent}
        </ScrollView>
        {statisticsAndControls}
        </> : null}
        {moveDetailShown ? <ScrollView testID="provider-move-detail" nestedScrollEnabled style={{ flexGrow: 0, flexShrink: 0, maxHeight: 180 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4 }} onLayout={event => setMoveDetailHeight(Math.min(180, event.nativeEvent.layout.height))}>{moveDetail}</ScrollView> : null}
        <FlashList
          key={`${productView}:${listRevision}`}
          horizontal={productView === 'carousel'}
          snapToInterval={productView === 'carousel' ? cardWidth : undefined}
          decelerationRate={productView === 'carousel' ? 'fast' : 'normal'}
          disableIntervalMomentum={productView === 'carousel'}
          initialScrollIndex={productView === 'carousel' ? Math.max(0, productItems.findIndex(item => item.id === activeProduct?.id)) : undefined}
          onScroll={event => { if (productView === 'list') { listOffset.current = event.nativeEvent.contentOffset.y;
            const session = providerSessions.get(provider); if (session) session.offset = listOffset.current; } }}
          ref={scrollRef}
          drawDistance={FLASH_LIST_DRAW_DISTANCE}
          data={productItems}
          onLayout={() => { setLayoutReady(true); listReadiness.onRevisionLayout(); }}
          onCommitLayoutEffect={listReadiness.onCommitLayoutEffect}
          onLoad={() => { listReadiness.onLoad(); if (productView === 'list' && listOffset.current) scrollRef.current?.scrollToOffset({ offset: listOffset.current, animated: false }); }}
          onContentSizeChange={listReadiness.onContentSizeChange}
          onViewableItemsChanged={info => { listReadiness.onViewableItemsChanged(info); if (productView === 'carousel') { const item = info.viewableItems.find(token => token.isViewable)?.item; if (item) setSelectedProduct(item.id); } }}
          viewabilityConfig={{ itemVisiblePercentThreshold: productView === 'carousel' ? 51 : 1, minimumViewTime: 16 }}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 12 + insets.bottom }}
          renderItem={renderProductItem}
          ListEmptyComponent={<EmptyState title="No current products" />}
          ListHeaderComponent={productView === 'list' ? <View testID="provider-list-header" style={{ marginHorizontal: -16, paddingBottom: 8 }}>
            <View style={{ paddingHorizontal: 16 }}>{chartContent}</View>
            {statisticsAndControls}
          </View> : null}
          ListFooterComponent={productView === 'list' ? <View>{moveDetail}</View> : null}
        />
        {productView === 'carousel' && productItems.length > 1 ? <Row onLayout={event => setCarouselNavigationHeight(event.nativeEvent.layout.height)} gap={8} style={{ flexShrink: 0, padding: 8, justifyContent: 'space-between' }}>
          <Chip label="Previous" icon="chevron-back" onPress={() => {
            const index = Math.max(0, productItems.findIndex(item => item.id === activeProduct?.id) - 1);
            setSelectedProduct(productItems[index].id); scrollRef.current?.scrollToIndex({ index, animated: true });
          }} />
          <AppText variant="tiny">{uiJoin(uiCount(productItems.findIndex(item => item.id === activeProduct?.id) + 1), ' / ', uiCount(productItems.length))}</AppText>
          <Chip label="Next" icon="chevron-forward" onPress={() => {
            const index = Math.min(productItems.length - 1, productItems.findIndex(item => item.id === activeProduct?.id) + 1);
            setSelectedProduct(productItems[index].id); scrollRef.current?.scrollToIndex({ index, animated: true });
          }} />
        </Row> : null}
        </View>
      </Screen>
    </>
  );
}
