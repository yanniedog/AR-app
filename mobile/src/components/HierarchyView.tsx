import Ionicons from '@expo/vector-icons/Ionicons';
import { useScrollToTop } from '@react-navigation/native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SECTIONS } from '../constants';
import { visibleAccountRows } from '../data/format';
import { resolveSectionRibbonStats } from '../data/ribbonStats';
import { sortRows, excludeTokenDepositRates, rankFraction, type MortgageRateMetric, type RankMetric } from '../data/selectors';
import {
  childrenFromScoped,
  rowsUnder,
  statsFor,
  type TaxoNode,
} from '../data/taxonomy';
import { useStore } from '../data/store';
import { logCategoryRowPress } from '../lib/degradationLog';
import { debugLog } from '../lib/debugLog';
import { openBrowseDrill, openProduct, openProductsList } from '../lib/nav';
import { useSuitabilityRevision } from '../hooks/useSuitabilityRevision';
import { usePerformanceAuditSurface } from '../hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../hooks/useLogoReadiness';
import { useVirtualizedListReadiness } from '../hooks/useVirtualizedListReadiness';
import { auditActionString, auditActionStrings } from '../lib/performanceAuditActionParams';
import { SECTION_KEYS, type ProductDetail, type RateRow, type SectionKey } from '../types';
import { useTheme } from '../theme/ThemeProvider';
import { SectionCrossfade } from './controls';
import { CategoryRow } from './CategoryRow';
import { ProductCard } from './ProductCard';
import { Ribbon } from './Ribbon';
import { screenScrollContentStyle } from './Screen';
import { AppText, Card, Row } from './ui';
import { EmptyState } from './feedback';

type Item = { kind: 'node'; node: TaxoNode } | { kind: 'product'; row: RateRow };

/** Pure, expensive derivation of the rows/categories/stats shown for one
 *  section+path. Scopes the rows once (`under`) and reuses that set for the
 *  category grouping and stats instead of re-scanning every section row. */
function computeHierarchyView(
  all: RateRow[],
  sectionData: Parameters<typeof resolveSectionRibbonStats>[0],
  section: SectionKey,
  path: string[],
  includeNonStandard: boolean,
  depositRankMetric: RankMetric = 'base',
  detailsProducts?: Record<string, ProductDetail> | null,
  mortgageRateMetric: MortgageRateMetric = 'comparison',
) {
  const under = rowsUnder(all, section, path);
  const nodeRows = excludeTokenDepositRates(
    visibleAccountRows(under, includeNonStandard, detailsProducts),
    section,
  );
  const fractionOf = (row: RateRow) =>
    rankFraction(row, section, depositRankMetric, mortgageRateMetric);
  const kids = childrenFromScoped(nodeRows, section, path, fractionOf);
  const stats =
    path.length === 0
      ? resolveSectionRibbonStats(
          sectionData,
          under,
          includeNonStandard,
          section,
          detailsProducts,
          depositRankMetric,
          mortgageRateMetric,
        )
      : statsFor(nodeRows, true, section, fractionOf);
  let data: Item[];
  if (kids.length) {
    data = kids.map((node) => ({ kind: 'node', node }) as Item);
  } else {
    const seen = new Set<string>();
    data = sortRows(nodeRows, 'rate', section, depositRankMetric, mortgageRateMetric)
      .filter((r) => (seen.has(r.product_key) ? false : seen.add(r.product_key)))
      .map((row) => ({ kind: 'product', row }) as Item);
  }
  // Shared rate scale across sibling categories so their ranges compare 1:1.
  let dMin: number | null = null;
  let dMax: number | null = null;
  for (const k of kids) {
    if (k.stats.min !== null) dMin = dMin === null ? k.stats.min : Math.min(dMin, k.stats.min);
    if (k.stats.max !== null) dMax = dMax === null ? k.stats.max : Math.max(dMax, k.stats.max);
  }
  const siblingDomain = dMin !== null && dMax !== null && dMax > dMin ? { min: dMin, max: dMax } : null;
  return { stats, children: kids, items: data, siblingDomain };
}

// Cache the derivation across section switches AND remounts, keyed by the source
// rows array. The WeakMap auto-evicts when a new payload replaces `core`, so
// toggling Mortgage<->Savings<->TD (or returning to a drill) is an instant cache
// hit instead of re-scanning thousands of rows on the JS thread every time.
// Nested by detailsProducts identity so the post-details suitability pass is
// cached too (previously we skipped the WeakMap whenever details were loaded).
const viewCache = new WeakMap<object, WeakMap<object, Map<string, ReturnType<typeof computeHierarchyView>>>>();
const NO_DETAILS = {} as object;
const EMPTY_VIEW = {
  stats: statsFor([]),
  children: [] as TaxoNode[],
  items: [] as Item[],
  siblingDomain: null as { min: number; max: number } | null,
};

export function HierarchyView({ section, path }: { section: SectionKey; path: string[] }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<Item>>(null);
  useScrollToTop(listRef);
  const sectionData = useStore((s) => s.core?.sections[section]);
  const datasetRevision = useStore(
    (s) => s.manifest?.files.core.sha256 ?? s.core?.run_date ?? null,
  );
  const detailsRevision = useStore((s) => s.details?.run_date ?? 'none');
  const rows = sectionData?.rates;
  const rba = useStore((s) => s.core?.rba?.at(-1)?.rate ?? null);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const suitabilityRevision = useSuitabilityRevision();
  const pathKey = path.join('.');

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [section, pathKey]);

  const { stats, children, items, siblingDomain } = useMemo(() => {
    // No data yet (initial load / section transition): nothing to cache, and the
    // component renders null below anyway.
    if (!rows || !sectionData) return EMPTY_VIEW;
    let byDetails = viewCache.get(sectionData);
    if (!byDetails) {
      byDetails = new WeakMap();
      viewCache.set(sectionData, byDetails);
    }
    const detailsKey = (detailsProducts as object | null) ?? NO_DETAILS;
    let byKey = byDetails.get(detailsKey);
    if (!byKey) {
      byKey = new Map();
      byDetails.set(detailsKey, byKey);
    }
    const cacheKey = `${section}|${pathKey}|${includeNonStandard ? 1 : 0}|${depositRankMetric}|${mortgageRateMetric}|${suitabilityRevision}`;
    let cached = byKey.get(cacheKey);
    if (!cached) {
      // #region agent log
      const _t1 = Date.now();
      cached = computeHierarchyView(
        rows,
        sectionData,
        section,
        path,
        includeNonStandard,
        depositRankMetric,
        detailsProducts,
        mortgageRateMetric,
      );
      debugLog.debug(
        'perf',
        `hierarchy cache-miss ms=${Date.now() - _t1} section=${section} path=${pathKey || '(root)'} rows=${rows.length} details=${detailsProducts ? 'yes' : 'no'}`,
      );
      // #endregion
      byKey.set(cacheKey, cached);
    }
    return cached;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pathKey encodes path
  }, [rows, sectionData, section, pathKey, includeNonStandard, depositRankMetric, mortgageRateMetric, detailsProducts, suitabilityRevision]);

  const setActiveSection = useStore((s) => s.setActiveSection);
  const interests = useStore((s) => s.prefs.interests);
  const availableSections = interests;
  const changeSection = useCallback((next: SectionKey) => {
    setActiveSection(next);
    openBrowseDrill(next);
  }, [setActiveSection]);
  const auditActions = useMemo(() => ({
    'browse.open': () => undefined,
    'browse.section.next': () => {
      const current = Math.max(0, availableSections.indexOf(section));
      const next = availableSections[(current + 1) % availableSections.length];
      if (next) changeSection(next);
    },
    'browse.category.first': (...args: unknown[]) => {
      const requested = auditActionString(args, 'section');
      const exactPath = auditActionStrings(args, 'taxonomyPath');
      if (
        requested &&
        SECTION_KEYS.includes(requested as SectionKey) &&
        availableSections.includes(requested as SectionKey) &&
        exactPath.length
      ) {
        openBrowseDrill(requested as SectionKey, [exactPath[0]]);
        return;
      }
      const first = children[0];
      if (!first) {
        return {
          unavailableReason: 'No category children are available on the current browse node',
        };
      }
      openBrowseDrill(section, [...path, first.seg]);
    },
    'browse.category.deepest': (...args: unknown[]) => {
      const requested = auditActionString(args, 'section');
      const exactPath = auditActionStrings(args, 'taxonomyPath');
      if (!exactPath.length) {
        return {
          unavailableReason: 'No taxonomy path is available for deepest category drill',
        };
      }
      if (
        requested &&
        (!SECTION_KEYS.includes(requested as SectionKey) ||
          !availableSections.includes(requested as SectionKey))
      ) {
        return { unavailableReason: 'The requested audit section is not available' };
      }
      const targetSection = requested ? requested as SectionKey : section;
      openBrowseDrill(targetSection, exactPath);
    },
    'browse.category.back': () => openBrowseDrill(section, path.slice(0, -1)),
    'browse.products.all': () => openProductsList(section, path),
  }), [availableSections, changeSection, children, path, section]);
  const listRevision = [
    datasetRevision ?? 'none',
    detailsRevision,
    section,
    pathKey,
    includeNonStandard ? 'all' : 'standard',
    depositRankMetric,
    mortgageRateMetric,
    suitabilityRevision,
    items.length,
  ].join(':');
  const listReadiness = useVirtualizedListReadiness(listRevision, items.length);
  const logoReadiness = useLogoReadiness(listRevision);
  usePerformanceAuditSurface({
    id: 'browse.hierarchy',
    routeKey: '/browse',
    datasetRevision,
    renderRevision: listRevision,
    actions: auditActions,
    probes: [
      {
        id: 'browse.data',
        kind: 'data',
        status: rows ? 'ready' : 'pending',
        datasetRevision,
      },
      {
        id: 'browse.list',
        kind: 'list',
        status: rows && listReadiness.visiblyCommitted ? 'ready' : 'pending',
        datasetRevision,
        expectedCount: items.length,
        actualCount: listReadiness.committedItemCount,
      },
      {
        id: 'browse.layout',
        kind: 'layout',
        status: listReadiness.ready ? 'ready' : 'pending',
        renderRevision: listRevision,
      },
      {
        id: 'browse.graphics',
        kind: 'graphic',
        required: false,
        status: 'ready',
        renderRevision: `${section}:${pathKey}:${stats.products}`,
      },
      {
        id: 'browse.logos',
        kind: 'logo',
        required: false,
        status: logoReadiness.ready ? 'ready' : 'pending',
        expectedCount: logoReadiness.expectedCount,
        actualCount: logoReadiness.terminalCount,
        fallbackCount: logoReadiness.fallbackCount,
      },
    ],
  });

  if (!rows) return null;

  const isLeaf = children.length === 0;
  const meta = SECTIONS[section];

  const header = (
    <View key={listRevision} onLayout={listReadiness.onRevisionLayout}>
      {path.length > 0 && (
        <Pressable
          onPress={() => openBrowseDrill(section, path.slice(0, -1))}
          hitSlop={theme.spacing(2)}
          style={{ paddingHorizontal: theme.spacing(1) / 2, paddingBottom: theme.spacing(1) }}
        >
          <Row gap={4} style={{ alignItems: 'center' }}>
            <Ionicons name="chevron-back" size={16} color={theme.colors.primary} />
            <AppText variant="small" weight="700" style={{ color: theme.colors.primary }}>
              Back
            </AppText>
          </Row>
        </Pressable>
      )}
      <SectionCrossfade section={section}>
        <View>
          {isLeaf ? (
            <Card>
              <Ribbon stats={stats} section={section} rbaRate={section === 'Mortgage' ? rba : null} />
            </Card>
          ) : null}
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: theme.spacing(1) / 2 }}>
            <AppText variant="small" weight="700" color="textMuted">
              {isLeaf ? `${stats.products} ${stats.products === 1 ? 'PRODUCT' : 'PRODUCTS'}` : 'CATEGORIES'}
            </AppText>
            {!isLeaf ? (
              <Pressable onPress={() => openProductsList(section, path)} hitSlop={theme.spacing(2)}>
                <AppText variant="small" weight="700" style={{ color: theme.colors.primary }}>
                  All {stats.products} products →
                </AppText>
              </Pressable>
            ) : null}
          </Row>
        </View>
      </SectionCrossfade>
    </View>
  );

  return (
    <View style={{ flex: 1 }} onLayout={listReadiness.onRevisionLayout}>
      <FlashList
      ref={listRef}
      key={`browse:${listRevision}`}
      data={items}
      extraData={listRevision}
      onCommitLayoutEffect={listReadiness.onCommitLayoutEffect}
      onLoad={listReadiness.onLoad}
      onContentSizeChange={listReadiness.onContentSizeChange}
      onViewableItemsChanged={listReadiness.onViewableItemsChanged}
      viewabilityConfig={{ itemVisiblePercentThreshold: 1, minimumViewTime: 16 }}
      keyExtractor={(it, i) =>
        it.kind === 'node'
          ? `${section}-n-${it.node.seg}`
          : `${section}-p-${it.row.product_key}-${it.row.rate_index ?? i}`
      }
      contentContainerStyle={screenScrollContentStyle(theme, insets.bottom)}
      ItemSeparatorComponent={() => <View style={{ height: theme.spacing(3) }} />}
      ListHeaderComponent={header}
      ListEmptyComponent={<EmptyState title="No products here" />}
      renderItem={({ item }) =>
        item.kind === 'node' ? (
          <CategoryRow
            label={item.node.label}
            productCount={item.node.stats.products}
            providerCount={item.node.stats.providers}
            rate={meta.lowerIsBetter ? item.node.stats.min : item.node.stats.max}
            section={section}
            ribbonStats={item.node.stats}
            ribbonDomain={siblingDomain}
            onPress={() => { const nextPath = [...path, item.node.seg]; logCategoryRowPress({ section, label: item.node.label, pathBefore: path, pathAfter: nextPath, source: 'hierarchy' }); openBrowseDrill(section, nextPath); }}
          />
        ) : (
          <ProductCard
            row={item.row}
            section={section}
            logoRenderStateId={`browse:${section}:${pathKey}:${item.row.rate_index ?? 'default'}#${item.row.product_key}`}
            onLogoRenderStateChange={logoReadiness.onLogoRenderStateChange}
            onPress={() => openProduct(item.row.product_key, item.row.rate_index)}
          />
        )
      }
      />
    </View>
  );
}
