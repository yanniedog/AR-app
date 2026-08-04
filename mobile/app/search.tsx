import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterSheet } from '../src/components/FilterSheet';
import { EmptyState, IndeterminateProgressBar, LoadingRows } from '../src/components/feedback';
import { ProductCard } from '../src/components/ProductCard';
import { Screen, screenEdgeStyle, screenScrollContentStyle } from '../src/components/Screen';
import { ToolbarIconButton } from '../src/components/ToolbarIconButton';
import { SearchBar } from '../src/components/controls';
import { AppText, Button, Chip, Row } from '../src/components/ui';
import { SECTIONS, SECTION_ORDER } from '../src/constants';
import {
  activeFilterCount,
  EMPTY_FILTERS,
  normalizeSortKey,
  queryAndSort,
  type Filters,
  type SortKey,
} from '../src/data/selectors';
import { ensurePermissions, registerBackgroundRefresh } from '../src/data/notifications';
import { profileToFilters } from '../src/data/profile';
import { findSearchSubscription, type SearchSubscription } from '../src/data/subscriptions';
import { useStore } from '../src/data/store';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import { useDebouncedValue } from '../src/hooks/useDebouncedValue';
import { breadcrumb, rowsForSearchScope } from '../src/data/taxonomy';
import { hapticSelection } from '../src/lib/haptics';
import { openCompare, openProduct, scalarRouteParam } from '../src/lib/nav';
import { canAddAlertSubscription, effectiveDeepSearch } from '../src/lib/proAccess';
import type { SectionKey } from '../src/types';
import { useTheme } from '../src/theme/ThemeProvider';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'rate', label: 'Best rate' },
  { key: 'comparison', label: 'Comparison' },
  { key: 'bank', label: 'Bank A-Z' },
];

const rowToken = (r: { rate_index?: number | string; product_key: string }) =>
  `${r.rate_index ?? ''}#${r.product_key}`;

export default function Search() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    section: string | string[];
    path?: string | string[];
    sort?: string | string[];
    scope?: string | string[];
    query?: string | string[];
    sub?: string | string[];
  }>();
  const secRaw = scalarRouteParam(params.section);
  const pathRaw = scalarRouteParam(params.path);
  const sortRaw = scalarRouteParam(params.sort);
  const scopeRaw = scalarRouteParam(params.scope);
  const queryRaw = scalarRouteParam(params.query);
  const subRaw = scalarRouteParam(params.sub);
  const section = (SECTION_ORDER.includes(secRaw as SectionKey) ? secRaw : 'Mortgage') as SectionKey;
  const path = useMemo(() => (pathRaw ?? '').split('.').filter(Boolean), [pathRaw]);
  const hierarchyScoped = scopeRaw === 'hierarchy';
  const core = useStore((s) => s.core);
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
    // Suitability filtering needs product details even when Pro deep-search
    // warming is off; force bypasses shouldWarmDetails for default prefs.
    void ensureDetails({ force: true });
    if (!deepSearchActive) return;
    void ensureSearchIndex();
  }, [deepSearchActive, ensureDetails, ensureSearchIndex, coreKey, detailsKey]);

  const [query, setQuery] = useState(() => restoredSub?.query ?? queryRaw ?? '');
  const debouncedQuery = useDebouncedValue(query, 120);
  const [sortKey, setSortKey] = useState<SortKey>(() => normalizeSortKey(restoredSub?.sort ?? sortRaw));
  // Seed from the saved product profile so users don't re-select the same
  // attributes on every screen; still fully overridable here.
  const [filters, setFilters] = useState<Filters>(() =>
    restoredSub
      ? { ...EMPTY_FILTERS, ...restoredSub.filters }
      : profileToFilters(useStore.getState().prefs.profileFilters, section, EMPTY_FILTERS),
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => setSortKey(normalizeSortKey(sortRaw)), [sortRaw]);

  useEffect(() => {
    if (!restoredSub) return;
    setQuery(restoredSub.query);
    setSortKey(normalizeSortKey(restoredSub.sort));
    setFilters({ ...EMPTY_FILTERS, ...restoredSub.filters });
  }, [restoredSub]);

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

  const rows = useMemo(
    () => (
      void suitabilityRevision,
      queryAndSort(
        baseRows,
        { ...effectiveFilters, query: debouncedQuery },
        sortKey,
        section,
        // Always pass loaded details for suitability (standard-only) filtering —
        // not only when Pro deep-search is on. Search indexing still requires Pro.
        details?.products ?? null,
        deepSearchActive ? searchIndex : null,
        depositRankMetric,
        mortgageRateMetric,
      )
    ),
    [baseRows, effectiveFilters, debouncedQuery, sortKey, section, deepSearchActive, details?.products, searchIndex, depositRankMetric, mortgageRateMetric, suitabilityRevision],
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
        includeNonStandard: effectiveFilters.includeNonStandard,
      },
    }),
    [section, path, hierarchyScoped, query, sortKey, effectiveFilters],
  );

  const searchSub = useStore((s) => findSearchSubscription(s.subscriptions, searchSnapshot));
  const searchIndexLoading = deepSearchActive && !searchIndex;
  const detailFiltersPending =
    (effectiveFilters.accountFeatures.length > 0 ||
      effectiveFilters.eligibilityCriteria.length > 0) &&
    !details?.products;

  const onToggleSearchAlert = async () => {
    if (searchSub) {
      unsubscribeSearch(searchSub.id);
      return;
    }
    if (!canAddAlertSubscription(subscriptions, useStore.getState().prefs)) {
      return;
    }
    const ok = await ensurePermissions();
    if (!ok) {
      Alert.alert('Notifications disabled', 'Enable notifications for Australian Rates in system settings.');
      return;
    }
    if (!notificationsEnabled) {
      setPref('notificationsEnabled', true);
      void registerBackgroundRefresh();
    }
    const added = subscribeSearch(searchSnapshot);
    if (!added) Alert.alert('Already subscribed', 'This search already has a rate alert.');
  };

  const toggleSelect = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].slice(-4)));

  if (!core) return null;
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
            onPress={() => {
              hapticSelection();
              setSelectMode((v) => !v);
              setSelected([]);
            }}
            accessibilityLabel="Select products to compare"
          />
        </Row>
        <Row gap={theme.spacing(2)} style={{ flexWrap: 'wrap' }}>
          {SORT_OPTIONS.map((o) => (
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
              Deep product search (free beta) matches fees, features, and eligibility.
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <FlashList
          data={rows}
          keyExtractor={(item, i) => `${item.product_key}-${item.rate_index ?? i}`}
          contentContainerStyle={{
            ...screenScrollContentStyle(theme, insets.bottom),
            paddingBottom: theme.spacing(6) + insets.bottom + theme.spacing(8),
          }}
          renderItem={({ item }) => (
            <ProductCard
              row={item}
              section={section}
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
                      subtitle="Feature and eligibility filters need the details payload. Retry when online, or clear those filters."
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
