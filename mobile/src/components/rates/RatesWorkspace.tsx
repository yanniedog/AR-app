import { uiCount,uiJoin,uiLabel,uiRatesQuery,uiProductName,uiProviderName,type UiCopy } from '../../lib/uiCopy';
import { humanizeEnum } from '../../data/format';
import { useReadyNavigationEffect } from '../../hooks/useReadyNavigationEffect';
import { SheetSurface } from '../SheetSurface';
import { TouchTarget } from '../TouchTarget';
import { SegmentedControl } from '../controls';
import { sectionSegmentOptions } from '../../data/interests';
import { verifiedCatalogueDetails, detailsOnlyCatalogue } from '../../data/detailsCatalogue';
import { EMPTY_SEARCH_FILTER_OPTIONS } from '../../data/searchFilterOptions';
import { initializeRatesSession, changeRatesSection, updateRatesSection, recordRatesScroll, useRatesSession, type RateAvailability } from '../../data/ratesSession';
import { ratesIntentKey, resolveRatesIntent, RATES_INTENT_KEYS, type RatesRouteParams } from '../../lib/ratesIntent';
import { OpaquePerformanceAuditRenderRevision } from '../../lib/performanceAuditReadiness';
import { SearchReportExport } from '../../components/SearchReportExport';
import { isSuitabilityFilterReady } from '../../data/suitabilityGate';
import Ionicons from '../../components/icons/AppIcon';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useIsFocused } from '@react-navigation/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterSheet } from '../../components/FilterSheet';
import { EmptyState, IndeterminateProgressBar, LoadingRows, ScreenSkeleton } from '../../components/feedback';
import { ProductCard } from '../../components/ProductCard';
import { Screen, screenEdgeStyle, screenScrollContentStyle } from '../../components/Screen';
import { ToolbarIconButton } from '../../components/ToolbarIconButton';
import { SearchBar } from '../../components/controls';
import { AppText, Button, Row } from '../../components/ui';
import { SECTION_ORDER } from '../../constants';
import {
  activeFilterCount,
  EMPTY_FILTERS,
  filterRows,
  type Filters,
  type SortKey,
} from '../../data/selectors';
import { ensurePermissions } from '../../data/notifications';
import { toggleCompareSelection } from '../../data/compareSelection';
import { findSearchSubscription, type SearchSubscription } from '../../data/subscriptions';
import { useStore } from '../../data/store';
import { useSuitabilityRevision } from '../../hooks/useSuitabilityRevision';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { usePerformanceAuditSurface } from '../../hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../../hooks/useLogoReadiness';
import { useVirtualizedListReadiness } from '../../hooks/useVirtualizedListReadiness';
import { useSearchFilterOptions } from '../../hooks/useSearchFilterOptions';
import { usePreparedSearchRows } from '../../hooks/usePreparedSearchRows';
import { rowsForSearchScope } from '../../data/taxonomy';
import { hapticSelection } from '../../lib/haptics';
import { openCompare, openProduct } from '../../lib/nav';
import {
  auditActionString,
  auditActionStrings,
} from '../../lib/performanceAuditActionParams';
import { effectiveDeepSearch } from '../../lib/proAccess';
import { scheduleAfterInteractions } from '../../lib/yieldToUi';
import type { RateRow, SectionKey } from '../../types';
import type { LogoRenderState } from '../../lib/logoReadiness';
import { useTheme } from '../../theme/ThemeProvider';

function availableSortOptions(
  section: SectionKey,
  mortgageMetric: 'headline' | 'comparison',
  depositMetric: 'base' | 'max',
): { key: SortKey; label: UiCopy }[] {
  if (section === 'Mortgage') {
    return mortgageMetric === 'comparison'
      ? [{ key: 'rate', label: uiLabel("Comparison rate") }, { key: 'bank', label: uiLabel("Bank A–Z") }]
      : [
          { key: 'rate', label: uiLabel("Advertised rate") },
          { key: 'comparison', label: uiLabel("Comparison rate") },
          { key: 'bank', label: uiLabel("Bank A–Z") },
        ];
  }
  return [
    { key: 'rate', label: section === 'TD' ? 'Advertised rate' : depositMetric === 'base' ? 'Ongoing rate' : 'Headline rate' },
    { key: 'bank', label: uiLabel("Bank A–Z") },
  ];
}

const rowToken = (r: { rate_index?: number | string; product_key: string }) =>
  r.rate_index == null ? r.product_key : `${r.rate_index}#${r.product_key}`;

const SearchProductRow = React.memo(function SearchProductRow({ row, section, selectMode, selected, onToggleSelect,
  onLogoRenderStateChange }: {
  row: RateRow; section: SectionKey; selectMode: boolean; selected: boolean;
  onToggleSelect: (token: string) => void;
  onLogoRenderStateChange: (id: string, state: LogoRenderState) => void;
}) {
  const onPress = useCallback(() => selectMode ? onToggleSelect(rowToken(row)) : openProduct(row.product_key, row.rate_index),
    [selectMode, onToggleSelect, row]);
  return <ProductCard row={row} section={section}
    logoRenderStateId={`search:${row.rate_index ?? 'default'}#${row.product_key}`}
    onLogoRenderStateChange={onLogoRenderStateChange} selectMode={selectMode} selected={selected} onPress={onPress} />;
});

export default function RatesWorkspace() {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const params = useLocalSearchParams() as RatesRouteParams;
  const intentKey = ratesIntentKey(params);
  const session = useRatesSession();
  const section = session.section;
  const task = session.sections[section];
  const path = task.path;
  const hierarchyScoped = task.hierarchyScoped;
  const hydrated = useStore(state => state.hydrated);
  const activeSection = useStore(state => state.activeSection);
  const prefs = useStore(state => state.prefs);
  const consumedIntent = useRef<string | null>(null);
  const sectionOptions = useMemo(() => sectionSegmentOptions(), []);
  const core = useStore((s) => s.core);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? null);
  const details = useStore((s) => s.details);
  const detailsLoading = useStore((s) => s.detailsLoading);
  const searchIndex = useStore((s) => s.searchIndex);
  const searchIndexSha = useStore((s) => s.manifest?.files.search_index?.sha256 ?? null);
  const searchIndexStatus = useStore((s) => s.searchIndexStatus);
  const source = useStore((s) => s.source);
  const deepSearchActive = useStore((s) => effectiveDeepSearch(s.prefs));
  const subscriptions = useStore((s) => s.subscriptions);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const ensureSearchIndex = useStore((s) => s.ensureSearchIndex);
  const coreIntegrity = useStore(state => state.coreIntegrity);
  const manifest = useStore(state => state.manifest);
  useReadyNavigationEffect(useCallback(() => {
    if (!hydrated || !isFocused) return;
    initializeRatesSession(prefs, activeSection);
    if (!intentKey) { consumedIntent.current = null; return; }
    if (intentKey === consumedIntent.current) return;
    const intent = resolveRatesIntent(params, useRatesSession.getState().section,
      subscriptions.filter((item): item is SearchSubscription => item.kind === 'search'));
    consumedIntent.current = intentKey;
    changeRatesSection(intent.section);
    useStore.getState().setActiveSection(intent.section);
    updateRatesSection(intent.section, intent.patch, true);
    router.setParams(Object.fromEntries(RATES_INTENT_KEYS.map(key => [key, undefined])));
  }, [activeSection, hydrated, intentKey, isFocused, params, prefs, subscriptions]));
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const notificationsEnabled = useStore((s) => s.prefs.notificationsEnabled);
  const setPref = useStore((s) => s.setPref);
  const subscribeSearch = useStore((s) => s.subscribeSearch);
  const unsubscribeSearch = useStore((s) => s.unsubscribeSearch);
  const suitabilityRevision = useSuitabilityRevision();
  // Re-run on content identity, not only calendar date: corrected same-day
  // cores must not leave deep Search idle against the previous edition.
  const coreKey = coreSha ?? core?.run_date ?? null;
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
  }, [deepSearchActive, ensureDetails, ensureSearchIndex, coreKey, detailsKey, searchIndexSha, isFocused]);
  // A cached core reports deep search unavailable until a refresh confirms the
  // same edition is live; that promotion changes only `source`, so retry on the
  // transition itself. Status is read, not depended on: other unavailable
  // results (e.g. local audits) cycle through loading and must not re-trigger.
  const previousSource = useRef(source);
  useEffect(() => {
    const promotedToRemote = previousSource.current !== 'remote' && source === 'remote';
    previousSource.current = source;
    if (promotedToRemote && isFocused && deepSearchActive &&
        useStore.getState().searchIndexStatus === 'unavailable') {
      void ensureSearchIndex();
    }
  }, [deepSearchActive, ensureSearchIndex, isFocused, source]);

  const query = task.query, sortKey = task.sort, filters = task.filters;
  const selectMode = task.selectMode, selected = task.selected, availability = task.availability;
  const setQuery = useCallback((value: string) => updateRatesSection(section, { query: value }, true), [section]);
  const setSortKey = useCallback((value: SortKey | ((current: SortKey) => SortKey)) =>
    updateRatesSection(section, current => ({ sort: typeof value === 'function' ? value(current.sort) : value }), true), [section]);
  const setSelected = useCallback((value: string[]) => updateRatesSection(section, { selected: value }), [section]);
  const debouncedQuery = useDebouncedValue(query, 120);
  const sortOptions = useMemo(() => availableSortOptions(section, mortgageRateMetric, depositRankMetric),
    [depositRankMetric, mortgageRateMetric, section]);
  const [filterOpen, setFilterOpen] = useState(false), [sortOpen, setSortOpen] = useState(false), [toolsOpen, setToolsOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<Filters>(filters);
  const [draftAvailability, setDraftAvailability] = useState<RateAvailability>(availability);
  const openFilters = useCallback(() => {
    setDraftAvailability(availability); setDraftFilters({ ...filters, includeNonStandard: task.includeNonStandardOverride ?? useStore.getState().prefs.includeNonStandard }); setFilterOpen(true);
  }, [availability, filters, task.includeNonStandardOverride]);
  const cancelFilters = useCallback(() => setFilterOpen(false), []);
  const applyFilters = useCallback((draft: Filters) => {
    const current = useRatesSession.getState().sections[section];
    const nextFilters = draftAvailability === 'unlisted' ? { ...EMPTY_FILTERS, providers: draft.providers }
      : { ...draft, includeNonStandard: current.filters.includeNonStandard };
    const filtersChanged = JSON.stringify(current.filters) !== JSON.stringify(nextFilters);
    if (filtersChanged || current.availability !== draftAvailability) {
      updateRatesSection(section, { availability: draftAvailability,
        filters: filtersChanged ? nextFilters : current.filters,
        ...(draftAvailability === 'unlisted' ? { path: [], hierarchyScoped: false, selectMode: false, selected: [] } : {}) }, true);
    }
    setFilterOpen(false);
  }, [draftAvailability, section]);
  const changeSection = useCallback((next: SectionKey) => {
    changeRatesSection(next); useStore.getState().setActiveSection(next);
    setFilterOpen(false); setSortOpen(false); setToolsOpen(false);
  }, []);
  useEffect(() => {
    if (sortKey === 'comparison' && (section !== 'Mortgage' || mortgageRateMetric === 'comparison')) setSortKey('rate');
  }, [mortgageRateMetric, section, setSortKey, sortKey]);

  const baseRows = useMemo(() => {
    void suitabilityRevision;
    const all = core?.sections[section]?.rates ?? [];
    return task.intentError ? [] : rowsForSearchScope(all, section, path, hierarchyScoped);
  }, [core, section, path, hierarchyScoped, suitabilityRevision, task.intentError]);
  const filterOptions = useSearchFilterOptions(baseRows, details?.products, section, suitabilityRevision);

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      includeNonStandard: task.includeNonStandardOverride ?? includeNonStandard,
    }),
    [filters, includeNonStandard, task.includeNonStandardOverride],
  );

  const resultFilters = useMemo(() => ({ ...effectiveFilters, query: debouncedQuery }),
    [effectiveFilters, debouncedQuery]);
  const preparedResults = usePreparedSearchRows(baseRows, resultFilters, sortKey, section,
    details?.products, deepSearchActive ? searchIndex : null, depositRankMetric, mortgageRateMetric,
    suitabilityRevision, isFocused);
  const rows = preparedResults.rows;
  const catalogueDetails = verifiedCatalogueDetails(core, coreIntegrity, manifest, details);
  const unlistedEntries = useMemo(() => {
    void suitabilityRevision;
    return core && catalogueDetails && !task.intentError ? detailsOnlyCatalogue(core, catalogueDetails) : [];
  }, [catalogueDetails, core, suitabilityRevision, task.intentError]);
  const unlistedRows = useMemo(() => {
    const term = debouncedQuery.trim().toLocaleLowerCase();
    return unlistedEntries.filter(item => (!term || [item.key, item.name, item.provider, item.productCategory, item.description]
      .filter(Boolean).join(' ').toLocaleLowerCase().includes(term)) &&
      (!filters.providers.length || filters.providers.includes(item.provider ?? '')));
  }, [debouncedQuery, filters.providers, unlistedEntries]);
  type ResultRow = RateRow | (typeof unlistedEntries)[number];
  const resultRows: ResultRow[] = availability === 'unlisted' ? unlistedRows : rows;
  const catalogueOptions = useMemo(() => ({ ...EMPTY_SEARCH_FILTER_OPTIONS,
    providers: [...new Set(unlistedEntries.map(item => item.provider).filter((value): value is string => Boolean(value)))].sort() }), [unlistedEntries]);
  const activeFilterOptions = draftAvailability === 'unlisted' ? catalogueOptions : filterOptions.options;

  const draftResultCount = useCallback(
    (draft: Filters) => (
      // Suitability rebuilds can keep the same row array; count against the gate the list uses.
      void suitabilityRevision,
      filterRows(
        baseRows,
        { ...draft, query: debouncedQuery },
        details?.products ?? null,
        deepSearchActive ? searchIndex : null,
        section,
      ).length
    ),
    [baseRows, debouncedQuery, details?.products, deepSearchActive, searchIndex, section, suitabilityRevision],
  );

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
  const searchIndexLoading =
    deepSearchActive &&
    !searchIndex &&
    (searchIndexStatus === 'idle' || searchIndexStatus === 'loading');
  const searchIndexUnavailable =
    deepSearchActive &&
    !searchIndex &&
    (searchIndexStatus === 'unavailable' || searchIndexStatus === 'error');
  const detailFiltersPending = !isSuitabilityFilterReady(effectiveFilters.includeNonStandard) ||
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
      Alert.alert('Notifications disabled');
      return;
    }
    if (!notificationsEnabled) {
      setPref('notificationsEnabled', true);
    }
    const added = subscribeSearch(searchSnapshot);
    if (!added) Alert.alert('Alert already saved');
  };

  const toggleSelect = useCallback((key: string) => {
    if (!core) return;
    const update = toggleCompareSelection(core, selected, key);
    if (update.rejection === 'limit_reached') {
      Alert.alert('Four-rate limit');
      return;
    }
    if (update.rejection === 'category_mismatch') {
      Alert.alert('Different rate types');
      return;
    }
    if (update.rejection === 'unavailable') {
      Alert.alert('Rate unavailable');
      return;
    }
    setSelected(update.tokens);
  }, [core, selected, setSelected]);

  const toggleCompareMode = useCallback(() => {
    hapticSelection();
    updateRatesSection(section, current => ({ selectMode: !current.selectMode, selected: [] }));
  }, [section]);
  const clearSearchFilters = useCallback(() => {
    updateRatesSection(section, { query: '', path: [], hierarchyScoped: false, intentError: null,
      filters: { ...EMPTY_FILTERS, includeNonStandard }, includeNonStandardOverride: null }, true);
  }, [includeNonStandard, section]);
  const selectAuditToken = useCallback((...args: unknown[]) => {
    const token = auditActionString(args, 'selectionToken');
    if (!token || !rows.some(row => rowToken(row) === token)) {
      return { unavailableReason: 'The selected exact rate is not in the current filtered search results' };
    }
    toggleSelect(token);
  }, [rows, toggleSelect]);
  const auditActions = useMemo(() => ({
    'search.open': () => undefined,
    'search.section.next': () => changeSection(SECTION_ORDER[(SECTION_ORDER.indexOf(section) + 1) % SECTION_ORDER.length]),
    'search.query.product': (...args: unknown[]) => {
      const exactQuery = auditActionString(args, 'query');
      if (exactQuery) setQuery(exactQuery);
    },
    'search.query.clear': () => setQuery(''),
    'search.sort.next': () => setSortKey((current) => {
      const index = sortOptions.findIndex((option) => option.key === current);
      return sortOptions[(index + 1) % sortOptions.length].key;
    }),
    'search.filters.open': openFilters,
    'search.filter.provider.first': (...args: unknown[]) => {
      const provider = auditActionString(args, 'provider');
      if (!filterOpen) return { unavailableReason: 'Filter sheet is closed' };
      if (provider) setDraftFilters(current => ({ ...current, providers: [provider] }));
    },
    'search.filters.apply': () => applyFilters(draftFilters),
    'search.filters.cancel': cancelFilters,
    'search.sort.open': () => setSortOpen(true),
    'search.sort.cancel': () => setSortOpen(false),
    'search.filters.clear': clearSearchFilters,
    'search.compare.mode': toggleCompareMode,
    'search.compare.select.0': selectAuditToken,
    'search.compare.select.1': selectAuditToken,
    'search.compare.open': (...args: unknown[]) => {
      const exactTokens = auditActionStrings(args, 'selectionTokens');
      const tokens = exactTokens.length >= 2 ? exactTokens : selected;
      if (tokens.length >= 2) openCompare(tokens);
    },
  }), [applyFilters, cancelFilters, changeSection, clearSearchFilters, draftFilters, filterOpen, openFilters, section, selected, selectAuditToken, setQuery, setSortKey, sortOptions, toggleCompareMode]);
  const intentPending = Boolean(intentKey && consumedIntent.current !== intentKey) || !session.initialized;
  const searchPending = intentPending || (availability === 'unlisted' ? !catalogueDetails : detailFiltersPending || searchIndexLoading || !preparedResults.ready);
  const dataTracker = useRef(new OpaquePerformanceAuditRenderRevision());
  const uiTracker = useRef(new OpaquePerformanceAuditRenderRevision());
  const listDataRevision = dataTracker.current.update([coreSha ?? core?.run_date ?? 'none', manifest?.files.details.sha256,
    section, path, hierarchyScoped, debouncedQuery, sortKey, effectiveFilters, availability, task.intentError,
    deepSearchActive, searchIndex != null, suitabilityRevision, resultRows.length]);
  // Selection and disclosure changes need a fresh committed render, but keep
  // the same list and decoded logos while its result identities are unchanged.
  const listRevision = uiTracker.current.update([listDataRevision, filterOpen, draftFilters, draftAvailability, sortOpen, toolsOpen, selectMode, selected]);
  const listReadiness = useVirtualizedListReadiness(listRevision, resultRows.length);
  const listRef = useRef<FlashListRef<ResultRow>>(null);
  // Initial native zero-offset events must not erase this list's requested restore.
  const restoration = useRef({ revision: listDataRevision, offset: task.scrollOffset });
  if (restoration.current.revision !== listDataRevision) restoration.current = { revision: listDataRevision, offset: task.scrollOffset };
  const restoreOffset = restoration.current.offset;
  useEffect(() => {
    // In-place selection/disclosure changes do not change visible indices, so
    // FlashList may omit its usual viewability callback. Request a fresh native
    // measurement after this render commits; layout alone is not visible proof.
    if (listReadiness.ready) listRef.current?.recomputeViewableItems();
  }, [listRevision, listReadiness.ready]);
  const logoReadiness = useLogoReadiness(listDataRevision);
  const renderProduct = useCallback(({ item }: { item: ResultRow }) => 'product_key' in item ? (
    <SearchProductRow row={item} section={section} onLogoRenderStateChange={logoReadiness.onLogoRenderStateChange}
      selectMode={selectMode} selected={selected.includes(rowToken(item))} onToggleSelect={toggleSelect} />
  ) : <TouchTarget fill onPress={() => openProduct(item.key)} accessibilityRole="button"
      accessibilityLabel={uiProductName({product_name:item.name??''})} style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <AppText variant="body" weight="600">{uiProductName({product_name:item.name??''})}</AppText>
      <AppText variant="small" color="textMuted">{uiJoin(uiProviderName({provider:item.provider??''}),' · ',humanizeEnum(item.productCategory??''))}</AppText>
      <AppText variant="small" color="textMuted">{uiLabel("No listed rate")}</AppText>
    </TouchTarget>, [section, logoReadiness.onLogoRenderStateChange, selectMode, selected, toggleSelect, theme.colors.border]);
  usePerformanceAuditSurface({
    id: 'rates.results',
    routeKey: '/browse',
    datasetRevision: coreSha ?? core?.run_date ?? null,
    renderRevision: listRevision,
    actions: auditActions,
    probes: [
      {
        id: 'search.data',
        kind: 'data',
        status: task.intentError || preparedResults.error ? 'error' : !searchPending && core ? 'ready' : 'pending',
        error: task.intentError ?? preparedResults.error,
        datasetRevision: coreSha ?? core?.run_date ?? null,
      },
      {
        id: 'search.list',
        kind: 'list',
        status: searchPending || !listReadiness.visiblyCommitted ||
          (resultRows.length > 0 && (listReadiness.measuredVisibleCount ?? 0) === 0) ? 'pending' : 'ready',
        expectedCount: resultRows.length,
        actualCount: listReadiness.committedItemCount,
        // A committed empty data set has no product rows even if FlashList
        // omits its empty viewability callback. Non-empty views require it.
        visibleCount: resultRows.length === 0 && listReadiness.ready ? 0 : listReadiness.measuredVisibleCount,
        emptyStateRendered: resultRows.length === 0 && !searchPending && listReadiness.ready,
      },
      {
        id: 'search.layout',
        kind: 'layout',
        status: listReadiness.ready ? 'ready' : 'pending',
        layoutMeasured: listReadiness.ready,
        renderRevision: listRevision,
      },
      {
        id: 'search.filters',
        kind: 'data',
        status: !filterOpen ? 'ready' : filterOptions.error ? 'error' : filterOptions.ready ? 'ready' : 'pending',
        error: filterOpen ? filterOptions.error : null,
      },
      {
        id: 'search.logos',
        kind: 'logo',
        required: false,
        status: logoReadiness.ready ? 'ready' : 'pending',
        expectedCount: logoReadiness.expectedCount,
        actualCount: logoReadiness.terminalCount,
        fallbackCount: logoReadiness.fallbackCount,
      },
    ],
  });

  if (!core || intentPending) return <ScreenSkeleton />;
  const filterCount = availability === 'unlisted' ? filters.providers.length : activeFilterCount(effectiveFilters);
  const sortLabel = availability === 'unlisted' ? 'All product types · No listed rate' : sortOptions.find(option => option.key === sortKey)?.label ?? 'Rate';
  // Keep whole 16sp action labels; narrower or enlarged text adds a row.
  const actionMinWidth = Math.min(Math.max(48, width - theme.spacing(8)), Math.ceil(80 * Math.max(1, fontScale) + 36));
  const actionStyle = { flexGrow: 1, flexShrink: 0, flexBasis: actionMinWidth, minWidth: actionMinWidth };
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Rates' }} />
      <View style={[screenEdgeStyle(theme), { gap: 8, paddingTop: 8, paddingBottom: 8 }]}>
        <SegmentedControl options={sectionOptions} value={section} onChange={changeSection} />
        <SearchBar value={uiRatesQuery(task)} onChangeText={setQuery} placeholder="Search rates or banks" />
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          <Button title={filterCount ? uiJoin('Filter',' (',uiCount(filterCount),')'):uiLabel("Filter")} variant="secondary" onPress={openFilters} style={actionStyle} />
          <Button title="Sort" variant="secondary" onPress={() => setSortOpen(true)} disabled={availability === 'unlisted'} style={actionStyle} />
          <Button title={uiLabel(selectMode ? 'Done' : 'Compare')} variant="secondary" onPress={toggleCompareMode} disabled={availability === 'unlisted'} style={actionStyle} />
        </Row>
        <Row gap={8}>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <AppText variant="tiny" color="textMuted">{uiJoin(searchPending ? 'Loading':uiJoin(uiCount(resultRows.length),' ','results'),searchSub?uiJoin(' · ','Alert on'):null)}</AppText>
            <AppText variant="tiny" color="textMuted">{sortLabel}</AppText>
          </View>
          <ToolbarIconButton icon="share-outline" onPress={() => setToolsOpen(true)} accessibilityLabel="Search actions" />
        </Row>
        {path.length ? <Button title="Clear scope" variant="ghost" onPress={() => updateRatesSection(section, { path: [], hierarchyScoped: false }, true)} /> : null}
        {searchIndexUnavailable ? <Row><AppText variant="tiny" color="textMuted">{uiLabel("Name search")}</AppText>
          {searchIndexStatus === 'error' ? <Button title="Retry search" variant="ghost" onPress={() => void ensureSearchIndex()} /> : null}</Row> : null}
      </View>

      <View style={{ flex: 1 }} onLayout={listReadiness.onRevisionLayout}>
        <FlashList
          ref={listRef}
          drawDistance={120}
          // Only changed result identities require a new list. Selection and
          // filter-sheet visibility commit in place through extraData below.
          key={`search:${listDataRevision}`}
          data={resultRows}
          onCommitLayoutEffect={listReadiness.onCommitLayoutEffect}
          onLoad={() => {
            listReadiness.onLoad();
            const offset = restoreOffset;
            const list = listRef.current;
            if (offset > 0 && list) requestAnimationFrame(() => {
              if (listRef.current === list && useRatesSession.getState().section === section) list.scrollToOffset({ offset, animated: false });
            });
          }}
          onContentSizeChange={listReadiness.onContentSizeChange}
          onViewableItemsChanged={listReadiness.onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 1, minimumViewTime: 16 }}
          extraData={listRevision}
          keyExtractor={(item, i) => 'product_key' in item ? `${item.product_key}-${item.rate_index ?? i}` : item.key}
          getItemType={item => 'product_key' in item ? 'rate' : 'unlisted'}
          onScroll={event => recordRatesScroll(section, event.nativeEvent.contentOffset.y)}
          scrollEventThrottle={64}
          contentContainerStyle={{
            ...screenScrollContentStyle(theme, insets.bottom, width),
            paddingTop: 0,
            paddingBottom: theme.spacing(6) + insets.bottom + theme.spacing(8),
          }}
          renderItem={renderProduct}
          ListEmptyComponent={
            task.intentError ? <EmptyState title="Scope unavailable" /> : availability === 'unlisted' && !catalogueDetails ? (
              <View style={{ paddingTop: 16, gap: 12 }}><EmptyState title={uiLabel(detailsLoading ? 'Loading' : 'Catalogue unavailable')} />
                {!detailsLoading ? <Button title="Retry" onPress={() => void ensureDetails({ forProductView: true, force: true, abandonInFlight: true })} /> : null}</View>
            ) : availability === 'listed' && detailFiltersPending ? (
              <View style={{ gap: theme.spacing(3), paddingTop: theme.spacing(4) }}>
                {detailsLoading ? (
                  <>
                    <IndeterminateProgressBar
                      caption="Loading"
                      accessibilityLabel="Preparing rates"
                    />
                    <LoadingRows count={3} />
                  </>
                ) : (
                  <View style={{ gap: theme.spacing(3) }}>
                    <EmptyState
                      title="Rates unavailable"
                    />
                    <Button
                      title="Retry"
                      variant="secondary"
                      onPress={() => void ensureDetails({ force: true, abandonInFlight: true })}
                    />
                  </View>
                )}
              </View>
            ) : preparedResults.error ? (
              <View style={{ gap: theme.spacing(3), paddingTop: theme.spacing(4) }}>
                <EmptyState title="Products unavailable"  />
                <Button title="Retry" variant="secondary" onPress={preparedResults.retry} />
              </View>
            ) : searchPending ? (
              <LoadingRows />
            ) : (
              <View style={{ gap: theme.spacing(3), paddingTop: theme.spacing(4) }}>
                <EmptyState
                  title="No matching products"
                />
                <Button
                  title="Clear filters"
                  variant="secondary"
                  onPress={clearSearchFilters}
                />
                <Button title="Profile" variant="ghost" onPress={() => router.push('/profile')} />
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
        onClose={cancelFilters}
        options={activeFilterOptions}
        optionsPending={draftAvailability === 'listed' && !filterOptions.ready && !filterOptions.error}
        optionsError={filterOptions.error}
        onRetryOptions={filterOptions.retry}
        filters={effectiveFilters}
        controlledDraft={draftFilters}
        onDraftChange={setDraftFilters}
        onApply={applyFilters}
        resultNoun={draftAvailability === 'listed' ? 'rates' : 'products'}
        resultCount={draftAvailability === 'listed' ? draftResultCount : draft => unlistedEntries.filter(item =>
          (!draft.providers.length || draft.providers.includes(item.provider ?? '')) &&
          (!debouncedQuery.trim() || [item.key, item.name, item.provider, item.productCategory, item.description].filter(Boolean).join(' ').toLocaleLowerCase().includes(debouncedQuery.trim().toLocaleLowerCase()))).length}
      >
        <View style={{ gap: 8 }}><AppText variant="small" weight="700">{uiLabel("Availability")}</AppText>
          <SegmentedControl value={draftAvailability} options={[{ value: 'listed', label: uiLabel("Listed rate") }, { value: 'unlisted', label: uiLabel("No listed rate") }]} onChange={setDraftAvailability} />
        </View>
      </FilterSheet>
      <SheetSurface visible={sortOpen} title="Sort" onClose={() => setSortOpen(false)}>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
          {(section === 'Mortgage' ? [{ label: uiLabel("Advertised rate"), metric: 'headline' }, { label: uiLabel("Comparison rate"), metric: 'comparison' }]
            : section === 'Savings' ? [{ label: uiLabel("Ongoing rate"), metric: 'base' }, { label: uiLabel("Headline rate"), metric: 'max' }]
            : [{ label: uiLabel("Advertised rate"), metric: 'base' }] as const).map(option => <Button key={option.metric} title={option.label} variant="ghost" onPress={() => {
              if (section === 'Mortgage') setPref('mortgageRateMetric', option.metric as 'headline' | 'comparison');
              else if (section === 'Savings') setPref('depositRankMetric', option.metric as 'base' | 'max');
              setSortKey('rate'); setSortOpen(false);
            }} />)}
          <Button title="Bank A–Z" variant="ghost" onPress={() => { setSortKey('bank'); setSortOpen(false); }} />
        </ScrollView>
      </SheetSurface>
      <SheetSurface visible={toolsOpen} title="Search" onClose={() => setToolsOpen(false)}>
        <ScrollView contentContainerStyle={{ gap: theme.spacing(4), paddingBottom: theme.spacing(4) }}>
          <Button
            icon={searchSub ? 'notifications' : 'notifications-outline'}
            title={uiLabel(searchSub ? 'Alert off' : 'Alert on')}
            disabled={availability === 'unlisted'}
            variant="ghost"
            onPress={() => void onToggleSearchAlert()}
          />
          <SearchReportExport disabled={availability === 'unlisted' || searchPending || query !== debouncedQuery} request={{ section, path, hierarchyScoped, query: debouncedQuery, filters: effectiveFilters, sort: sortKey, depositMetric: depositRankMetric, mortgageMetric: mortgageRateMetric, deepSearch: deepSearchActive }} />
        </ScrollView>
      </SheetSurface>
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
  const label=uiJoin('Compare',' ',uiCount(count));
  const isAndroid = Platform.OS === 'android';
  const edge = theme.spacing(4);
  const bottom = theme.spacing(6) + bottomInset;

  return (
    <TouchTarget
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
        {label}
      </AppText>
    </TouchTarget>
  );
}
