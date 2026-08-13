import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { useIsFocused } from '@react-navigation/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterSheet } from '../src/components/FilterSheet';
import { EmptyState, IndeterminateProgressBar, LoadingRows, ScreenSkeleton } from '../src/components/feedback';
import { ProductCard } from '../src/components/ProductCard';
import { Screen, screenEdgeStyle, screenScrollContentStyle } from '../src/components/Screen';
import { ToolbarIconButton } from '../src/components/ToolbarIconButton';
import { SearchBar } from '../src/components/controls';
import { AppText, Button, Chip, Row } from '../src/components/ui';
import { SECTIONS, SECTION_ORDER } from '../src/constants';
import {
  activeFilterCount,
  EMPTY_FILTERS,
  filterRows,
  normalizeSortKey,
  sortRows,
  type Filters,
  type SortKey,
} from '../src/data/selectors';
import { ensurePermissions } from '../src/data/notifications';
import { profileToFilters } from '../src/data/profile';
import { findSearchSubscription, type SearchSubscription } from '../src/data/subscriptions';
import { useStore } from '../src/data/store';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../src/hooks/useLogoReadiness';
import { useVirtualizedListReadiness } from '../src/hooks/useVirtualizedListReadiness';
import { breadcrumb, rowsForSearchScope } from '../src/data/taxonomy';
import { hapticSelection } from '../src/lib/haptics';
import { openCompare, openProduct, scalarRouteParam } from '../src/lib/nav';
import {
  auditActionString,
  auditActionStrings,
} from '../src/lib/performanceAuditActionParams';
import { effectiveDeepSearch } from '../src/lib/proAccess';
import { scheduleAfterInteractions } from '../src/lib/yieldToUi';
import type { SectionKey } from '../src/types';
import { useTheme } from '../src/theme/ThemeProvider';

function availableSortOptions(
  section: SectionKey,
  mortgageMetric: 'headline' | 'comparison',
  depositMetric: 'base' | 'max',
): { key: SortKey; label: string }[] {
  if (section === 'Mortgage') {
    return mortgageMetric === 'comparison'
      ? [{ key: 'rate', label: 'Comparison rate' }, { key: 'bank', label: 'Bank A-Z' }]
      : [
          { key: 'rate', label: 'Advertised rate' },
          { key: 'comparison', label: 'Comparison rate' },
          { key: 'bank', label: 'Bank A-Z' },
        ];
  }
  return [
    { key: 'rate', label: depositMetric === 'base' ? 'Ongoing rate' : 'Headline rate' },
    { key: 'bank', label: 'Bank A-Z' },
  ];
}

function compatibleSortKey(
  value: string | undefined,
  section: SectionKey,
  mortgageMetric: 'headline' | 'comparison',
): SortKey {
  const normalized = normalizeSortKey(value);
  if (normalized !== 'comparison') return normalized;
  return section === 'Mortgage' && mortgageMetric === 'headline' ? normalized : 'rate';
}

const rowToken = (r: { rate_index?: number | string; product_key: string }) =>
  r.rate_index == null ? r.product_key : `${r.rate_index}#${r.product_key}`;

export default function Search() {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    section: string | string[];
    path?: string | string[];
    sort?: string | string[];
    scope?: string | string[];
    query?: string | string[];
    sub?: string | string[];
    compare?: string | string[];
  }>();
  const secRaw = scalarRouteParam(params.section);
  const pathRaw = scalarRouteParam(params.path);
  const sortRaw = scalarRouteParam(params.sort);
  const scopeRaw = scalarRouteParam(params.scope);
  const queryRaw = scalarRouteParam(params.query);
  const subRaw = scalarRouteParam(params.sub);
  const compareRaw = scalarRouteParam(params.compare);
  const section = (SECTION_ORDER.includes(secRaw as SectionKey) ? secRaw : 'Mortgage') as SectionKey;
  const path = useMemo(() => (pathRaw ?? '').split('.').filter(Boolean), [pathRaw]);
  const hierarchyScoped = scopeRaw === 'hierarchy';
  const core = useStore((s) => s.core);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? null);
  const details = useStore((s) => s.details);
  const detailsLoading = useStore((s) => s.detailsLoading);
  const searchIndex = useStore((s) => s.searchIndex);
  const deepSearchActive = useStore((s) => effectiveDeepSearch(s.prefs));
  const subscriptions = useStore((s) => s.subscriptions);
  const restoredSub = useMemo(
    () => subscriptions.find(
      (sub): sub is SearchSubscription => sub.kind === 'search' && sub.id === subRaw,
    ),
    [subscriptions, subRaw],
  );
  const ensureDetails = useStore((s) => s.ensureDetails);
  const ensureSearchIndex = useStore((s) => s.ensureSearchIndex);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const notificationsEnabled = useStore((s) => s.prefs.notificationsEnabled);
  const setPref = useStore((s) => s.setPref);
  const subscribeSearch = useStore((s) => s.subscribeSearch);
  const unsubscribeSearch = useStore((s) => s.unsubscribeSearch);
  const suitabilityRevision = useSuitabilityRevision();
  // Re-run when core/details identity changes so Search warms after cold start
  // or a dataset refresh that cleared details (storeRefresh SHA swap).
  const coreKey = core?.run_date ?? null;
  const detailsKey = details?.run_date ?? null;
  useEffect(() => {
    if (!isFocused) return;
    // Paint the core-only search shell before installing multi-megabyte details
    // and rebuilding suitability/search indexes. Those store updates wake many
    // subscribers and previously landed directly on the navigation path.
    return scheduleAfterInteractions(() => {
      // Suitability filtering needs product details even when Pro deep-search
      // warming is off; force bypasses shouldWarmDetails for default prefs.
      void ensureDetails({ force: true });
      if (deepSearchActive) void ensureSearchIndex();
    });
  }, [deepSearchActive, ensureDetails, ensureSearchIndex, coreKey, detailsKey, isFocused]);

  const [query, setQuery] = useState(() => restoredSub?.query ?? queryRaw ?? '');
  const debouncedQuery = useDebouncedValue(query, 120);
  const [sortKey, setSortKey] = useState<SortKey>(() =>
    compatibleSortKey(restoredSub?.sort ?? sortRaw, section, mortgageRateMetric));
  const sortOptions = useMemo(
    () => availableSortOptions(section, mortgageRateMetric, depositRankMetric),
    [depositRankMetric, mortgageRateMetric, section],
  );
  // Seed from the saved product profile so users don't re-select the same
  // attributes on every screen; still fully overridable here.
  const [filters, setFilters] = useState<Filters>(() =>
    restoredSub
      ? { ...EMPTY_FILTERS, ...restoredSub.filters }
      : profileToFilters(useStore.getState().prefs.profileFilters, section, EMPTY_FILTERS),
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(compareRaw === '1');
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    setSortKey(compatibleSortKey(sortRaw, section, mortgageRateMetric));
  }, [mortgageRateMetric, section, sortRaw]);

  useEffect(() => {
    setSelectMode(compareRaw === '1');
  }, [compareRaw]);

  useEffect(() => {
    if (!restoredSub) return;
    setQuery(restoredSub.query);
    setSortKey(compatibleSortKey(restoredSub.sort, section, mortgageRateMetric));
    setFilters({ ...EMPTY_FILTERS, ...restoredSub.filters });
  }, [mortgageRateMetric, restoredSub, section]);

  const baseRows = useMemo(() => {
    const all = core?.sections[section]?.rates ?? [];
    return rowsForSearchScope(all, section, path, hierarchyScoped);
  }, [core, section, path, hierarchyScoped]);

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      includeNonStandard: restoredSub ? filters.includeNonStandard : includeNonStandard,
    }),
    [filters, includeNonStandard, restoredSub],
  );

  // Filtering preserves order, so sort the full section once instead of
  // sorting thousands of rows again on every query and filter change.
  const sortedBaseRows = useMemo(
    () => sortRows(baseRows, sortKey, section, depositRankMetric, mortgageRateMetric),
    [baseRows, sortKey, section, depositRankMetric, mortgageRateMetric],
  );
  const rows = useMemo(
    () => (
      void suitabilityRevision,
      filterRows(
        sortedBaseRows,
        { ...effectiveFilters, query: debouncedQuery },
        // Always pass loaded details for suitability (standard-only) filtering —
        // not only when Pro deep-search is on. Search indexing still requires Pro.
        details?.products ?? null,
        deepSearchActive ? searchIndex : null,
        section,
      )
    ),
    [sortedBaseRows, effectiveFilters, debouncedQuery, section, deepSearchActive, details?.products, searchIndex, suitabilityRevision],
  );

  const showDeepSearchHint =
    !!debouncedQuery.trim() && !deepSearchActive && rows.length === 0 && !activeFilterCount(effectiveFilters);

  const searchSnapshot = useMemo(
    () => ({
      section,
      path,
      hierarchyScoped,
      query,
      sort: sortKey,
      filters: {
        providers: effectiveFilters.providers,
        rateTypes: effectiveFilters.rateTypes,
        lvrTiers: effectiveFilters.lvrTiers,
        repaymentTypes: effectiveFilters.repaymentTypes,
        loanPurposes: effectiveFilters.loanPurposes,
        depositKinds: effectiveFilters.depositKinds,
        interestPayments: effectiveFilters.interestPayments,
        accountFeatures: effectiveFilters.accountFeatures,
        eligibilityCriteria: effectiveFilters.eligibilityCriteria,
        factCriteria: effectiveFilters.factCriteria,
        includeNonStandard: effectiveFilters.includeNonStandard,
      },
    }),
    [section, path, hierarchyScoped, query, sortKey, effectiveFilters],
  );

  const searchSub = useStore((s) => findSearchSubscription(s.subscriptions, searchSnapshot));
  const searchIndexLoading = deepSearchActive && !searchIndex;
  const detailFiltersPending =
    (effectiveFilters.accountFeatures.length > 0 ||
      effectiveFilters.eligibilityCriteria.length > 0 ||
      effectiveFilters.factCriteria.length > 0) &&
    !details?.products;

  const onToggleSearchAlert = async () => {
    if (searchSub) {
      unsubscribeSearch(searchSub.id);
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
    const added = subscribeSearch(searchSnapshot);
    if (!added) Alert.alert('Already subscribed', 'This search already has a rate alert.');
  };

  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].slice(-4)));
  }, []);

  const toggleCompareMode = useCallback(() => {
    hapticSelection();
    setSelectMode((value) => !value);
    setSelected([]);
  }, []);
  const auditActions = useMemo(() => ({
    'search.open': () => undefined,
    'search.query.product': (...args: unknown[]) => {
      const exactQuery = auditActionString(args, 'query');
      if (exactQuery) setQuery(exactQuery);
    },
    'search.query.clear': () => setQuery(''),
    'search.sort.next': () => setSortKey((current) => {
      const index = sortOptions.findIndex((option) => option.key === current);
      return sortOptions[(index + 1) % sortOptions.length].key;
    }),
    'search.filters.open': () => setFilterOpen(true),
    'search.filter.provider.first': (...args: unknown[]) => {
      const provider = auditActionString(args, 'provider');
      if (provider) setFilters((current) => ({ ...current, providers: [provider] }));
    },
    'search.filters.apply': () => setFilterOpen(false),
    'search.compare.mode': toggleCompareMode,
    'search.compare.select.0': (...args: unknown[]) => {
      const token = auditActionString(args, 'selectionToken');
      if (token && baseRows.some((row) => rowToken(row) === token)) toggleSelect(token);
    },
    'search.compare.select.1': (...args: unknown[]) => {
      const token = auditActionString(args, 'selectionToken');
      if (token && baseRows.some((row) => rowToken(row) === token)) toggleSelect(token);
    },
    'search.compare.open': (...args: unknown[]) => {
      const exactTokens = auditActionStrings(args, 'selectionTokens');
      const tokens = exactTokens.length >= 2 ? exactTokens : selected;
      if (tokens.length >= 2) openCompare(tokens);
    },
  }), [baseRows, selected, sortOptions, toggleCompareMode, toggleSelect]);
  const searchPending = detailFiltersPending || searchIndexLoading;
  const listRevision = JSON.stringify([
    coreSha ?? core?.run_date ?? 'none',
    details?.run_date ?? 'none',
    section,
    path,
    hierarchyScoped,
    debouncedQuery,
    sortKey,
    effectiveFilters,
    filterOpen,
    deepSearchActive,
    selectMode,
    selected,
    searchIndex != null,
    suitabilityRevision,
    rows.length,
  ]);
  const listReadiness = useVirtualizedListReadiness(listRevision, rows.length);
  const logoReadiness = useLogoReadiness(
    `${listRevision}:${selectMode ? 'select' : 'browse'}`,
  );
  usePerformanceAuditSurface({
    id: 'search.results',
    routeKey: '/search',
    datasetRevision: coreSha ?? core?.run_date ?? null,
    renderRevision: listRevision,
    actions: auditActions,
    probes: [
      {
        id: 'search.data',
        kind: 'data',
        status: core ? 'ready' : 'pending',
        datasetRevision: coreSha ?? core?.run_date ?? null,
      },
      {
        id: 'search.list',
        kind: 'list',
        status: searchPending || !listReadiness.visiblyCommitted ? 'pending' : 'ready',
        expectedCount: rows.length,
        actualCount: listReadiness.committedItemCount,
      },
      {
        id: 'search.layout',
        kind: 'layout',
        status: listReadiness.ready ? 'ready' : 'pending',
        renderRevision: listRevision,
      },
      {
        id: 'search.logos',
        kind: 'logo',
        required: false,
        status: logoReadiness.ready ? 'ready' : 'pending',
        expectedCount: logoReadiness.expectedCount,
        actualCount: logoReadiness.terminalCount,
      },
    ],
  });

  if (!core) return <ScreenSkeleton />;
  const title = path.length ? breadcrumb(section, path).at(-1)! : `${SECTIONS[section].title}`;
  const filterCount = activeFilterCount(effectiveFilters);

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <View style={screenEdgeStyle(theme)}>
        <Row gap={theme.spacing(3)}>
          <View style={{ flex: 1 }}>
            <SearchBar value={query} onChangeText={setQuery} />
          </View>
          <ToolbarIconButton
            icon="options"
            badge={filterCount || undefined}
            onPress={() => setFilterOpen(true)}
            accessibilityLabel="Filter products"
          />
          <ToolbarIconButton
            icon={selectMode ? 'git-compare' : 'git-compare-outline'}
            active={selectMode}
            onPress={toggleCompareMode}
            accessibilityLabel="Select products to compare"
          />
        </Row>
        <Row gap={theme.spacing(2)} style={{ flexWrap: 'wrap' }}>
          {sortOptions.map((o) => (
            <Chip key={o.key} label={o.label} selected={sortKey === o.key} onPress={() => setSortKey(o.key)} />
          ))}
          <Chip
            icon={searchSub ? 'notifications' : 'notifications-outline'}
            label={searchSub ? 'Search alert on' : 'Alert this search'}
            selected={!!searchSub}
            onPress={() => void onToggleSearchAlert()}
          />
        </Row>
        <AppText variant="tiny" color="textFaint">
          {rows.length} {rows.length === 1 ? 'product' : 'products'}
          {searchSub ? ` · alert saved as ${searchSub.label}` : ''}
        </AppText>
        {showDeepSearchHint ? (
          <Pressable onPress={() => setPref('enableDeepSearch', true)}>
            <AppText variant="tiny" color="primary" style={{ lineHeight: 16 }}>
              Search also matches published fees, features and eligibility.
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flex: 1 }} onLayout={listReadiness.onRevisionLayout}>
        <FlashList
          // Remount when the user-facing result identity changes so readiness
          // cannot stall after FlashList recycles without a fresh viewability pass.
          key={`search:${listRevision}`}
          data={rows}
          onCommitLayoutEffect={listReadiness.onCommitLayoutEffect}
          onLoad={listReadiness.onLoad}
          onContentSizeChange={listReadiness.onContentSizeChange}
          onViewableItemsChanged={listReadiness.onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 1, minimumViewTime: 16 }}
          extraData={listRevision}
          keyExtractor={(item, i) => `${item.product_key}-${item.rate_index ?? i}`}
          contentContainerStyle={{
            ...screenScrollContentStyle(theme, insets.bottom),
            paddingBottom: theme.spacing(6) + insets.bottom + theme.spacing(8),
          }}
          renderItem={({ item }) => (
            <ProductCard
              row={item}
              section={section}
              logoRenderStateId={`search:${item.rate_index ?? 'default'}#${item.product_key}`}
              onLogoRenderStateChange={logoReadiness.onLogoRenderStateChange}
              selectMode={selectMode}
              selected={selected.includes(rowToken(item))}
              onPress={() =>
                selectMode ? toggleSelect(rowToken(item)) : openProduct(item.product_key, item.rate_index)
              }
            />
          )}
          ListEmptyComponent={
            detailFiltersPending ? (
              <View style={{ gap: theme.spacing(3), paddingTop: theme.spacing(4) }}>
                {detailsLoading ? (
                  <>
                    <IndeterminateProgressBar
                      caption="Loading product features so account-feature filters can apply."
                      accessibilityLabel="Preparing feature filters"
                    />
                    <LoadingRows count={3} />
                  </>
                ) : (
                  <View style={{ gap: theme.spacing(3) }}>
                    <EmptyState
                      title="Could not load product features"
                      subtitle="Connect and retry, or clear the feature filters."
                    />
                    <Button
                      title="Retry"
                      variant="secondary"
                      onPress={() => void ensureDetails({ force: true, abandonInFlight: true })}
                    />
                  </View>
                )}
              </View>
            ) : searchIndexLoading ? (
              <LoadingRows />
            ) : (
              <View style={{ gap: theme.spacing(3), paddingTop: theme.spacing(4) }}>
                <EmptyState
                  title="No matching products"
                  subtitle="Your profile, search, or session filters may be narrowing the result."
                />
                <Button
                  title="Clear search and filters"
                  variant="secondary"
                  onPress={() => {
                    setQuery('');
                    setFilters({ ...EMPTY_FILTERS, includeNonStandard });
                  }}
                />
                <Button title="Edit product profile" variant="ghost" onPress={() => router.push('/profile')} />
              </View>
            )
          }
        />
      </View>

      {selectMode && selected.length >= 2 ? (
        <CompareFab
          count={selected.length}
          bottomInset={insets.bottom}
          onPress={() => openCompare(selected)}
        />
      ) : null}

      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        rows={baseRows}
        section={section}
        filters={effectiveFilters}
        detailsProducts={details?.products}
        onApply={setFilters}
      />
    </Screen>
  );
}

function CompareFab({
  count,
  bottomInset,
  onPress,
}: {
  count: number;
  bottomInset: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const label = `Compare ${count} product${count === 1 ? '' : 's'}`;
  const isAndroid = Platform.OS === 'android';
  const edge = theme.spacing(4);
  const bottom = theme.spacing(6) + bottomInset;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        position: 'absolute',
        ...(isAndroid
          ? { right: edge, bottom }
          : { left: edge, right: edge, bottom: theme.spacing(6) }),
        backgroundColor: theme.colors.primary,
        borderRadius: theme.radius.pill,
        minHeight: isAndroid ? 56 : undefined,
        paddingVertical: isAndroid ? 0 : theme.spacing(4),
        paddingHorizontal: isAndroid ? theme.spacing(5) : 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing(2),
        opacity: pressed ? 0.85 : 1,
        elevation: isAndroid ? 6 : 4,
      })}
    >
      <Ionicons name="git-compare" size={isAndroid ? 24 : 18} color={theme.colors.onPrimary} />
      <AppText variant="body" weight="800" style={{ color: theme.colors.onPrimary }}>
        {isAndroid ? `Compare ${count}` : label}
      </AppText>
    </Pressable>
  );
}
