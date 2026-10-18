import { publicScenarioForRow } from '../../data/publicRateIntegration';
import { mortgageComparisonScenario } from '../../data/mortgageComparisonScenario';
import type { RateScenario } from '../../data/publicRateModel';
import { ratesResultRowKey } from '../../data/ratesResultRowKey';
import { publicOfferSelectionToken } from '../../data/publicOfferIdentity';
import { PublicPricingCoverage, PublicProductDiscovery } from '../scenario/PublicPricingCoverage';
import { usePublicRateCatalogue } from '../../data/publicRateCatalogue';
import { publicComparisonCore, publicRateScenario, publicRecommendationRows, resolvedPublicRankingRows } from '../../data/publicRateIntegration';
import { useUserRateScenario } from '../../hooks/useUserRateScenario';
import { uiCount,uiJoin,uiLabel,uiRatesQuery,uiProductName,uiProviderName,type UiCopy } from '../../lib/uiCopy';
import { humanizeEnum } from '../../data/format';
import { useReadyNavigationEffect } from '../../hooks/useReadyNavigationEffect';
import { useBackOwnedSheetState } from '../../hooks/useBackOwnedSheetState';
import { SheetSurface } from '../SheetSurface';
import { TouchTarget } from '../TouchTarget';
import { SegmentedControl } from '../controls';
import { sectionSegmentOptions } from '../../data/interests';
import { verifiedCatalogueDetails, detailsOnlyCatalogue } from '../../data/detailsCatalogue';
import { EMPTY_SEARCH_FILTER_OPTIONS } from '../../data/searchFilterOptions';
import { initializeRatesSession, syncRatesPreferences, changeRatesSection, updateRatesSection, recordRatesScroll, getRatesSessionRestoreRevision, useRatesSession, type RateAvailability } from '../../data/ratesSession';
import { normalizeRatesPageSize, ratesPageWindow } from '../../data/ratesPagination';
import { ratesIntentKey, resolveRatesIntent, RATES_INTENT_KEYS, type RatesRouteParams } from '../../lib/ratesIntent';
import { OpaquePerformanceAuditRenderRevision } from '../../lib/performanceAuditReadiness';
import { useRatesAuditTarget } from '../../hooks/useRatesAuditTarget';
import { SearchReportExport } from '../../components/SearchReportExport';
import { isSuitabilityFilterReady } from '../../data/suitabilityGate';
import Ionicons from '../../components/icons/AppIcon';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, useWindowDimensions, View } from 'react-native';

import { FilterSheet } from '../../components/FilterSheet';
import { SavedRequirementsSummary } from '../SavedRequirementsSummary';
import { RatesPagination } from '../RatesPagination';
import { MortgageComparisonControls } from '../MortgageComparisonControls';
import { useMortgageComparison, mortgageComparisonRows, clearMortgageComparison } from '../../data/mortgageComparison';
import { EmptyState, IndeterminateProgressBar, LoadingRows, ScreenSkeleton } from '../../components/feedback';
import { ProductCard } from '../../components/ProductCard';
import { IconAction } from '../../components/IconAction';
import { Screen, screenScrollContentStyle } from '../../components/Screen';
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
import { resolveCompareSelections, toggleCompareSelection } from '../../data/compareSelection';
import { isMandatoryEligibilityReady } from '../../data/eligibilityGate';
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

const rowToken = (r: RateRow) => r.public_offer_id ? publicOfferSelectionToken(r.product_key, r.public_offer_id) :
  r.rate_index == null ? r.product_key : `${r.rate_index}#${r.product_key}`;

const SearchProductRow = React.memo(function SearchProductRow({ row, section, selectMode, selected, onToggleSelect,
  onLogoRenderStateChange, comparisonUnverified, rateScenario, auditCell, auditRevision, onAuditCellCommit }: {
  row: RateRow; section: SectionKey; selectMode: boolean; selected: boolean;
  onToggleSelect: (token: string) => void;
  onLogoRenderStateChange: (id: string, state: LogoRenderState) => void;
  comparisonUnverified: boolean; rateScenario: RateScenario;
  auditCell: boolean; auditRevision: string;
  onAuditCellCommit: (row: RateRow, revision: string) => () => void;
}) {
  useLayoutEffect(() => auditCell ? onAuditCellCommit(row, auditRevision) : undefined,
    [auditCell, auditRevision, onAuditCellCommit, row]);
  const onPress = useCallback(() => selectMode ? onToggleSelect(rowToken(row)) : openProduct(row.product_key, row.rate_index, row.public_programme_id),
    [selectMode, onToggleSelect, row]);
  return <ProductCard row={row} section={section} comparisonUnverified={comparisonUnverified} rateScenario={rateScenario}
    logoRenderStateId={`search:${row.rate_index ?? 'default'}#${row.product_key}`}
    onLogoRenderStateChange={onLogoRenderStateChange} selectMode={selectMode} selected={selected} onPress={onPress} />;
});

export default function RatesWorkspace() {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const sheetNavigation = useNavigation();
  const { width } = useWindowDimensions();
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
  useEffect(() => syncRatesPreferences(prefs), [prefs]);
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
  const catalogue = usePublicRateCatalogue(manifest);
  const { scenario } = useUserRateScenario();
  const mortgageInputs = useMortgageComparison();
  const mortgageFilters = session.sections.Mortgage.filters;
  const scenarioFor = useCallback((selected: SectionKey, row?: RateRow) => publicScenarioForRow(row, catalogue, mortgageComparisonScenario(selected,
    publicRateScenario(selected, scenario, prefs.profileFilters, row), mortgageInputs, mortgageFilters)), [catalogue, scenario, prefs.profileFilters, mortgageInputs, mortgageFilters]);
  const rowScenario = useCallback((row: RateRow) => scenarioFor(section, row), [scenarioFor, section]);
  const comparisonCore = useMemo(() => core ? publicComparisonCore(core, catalogue, scenarioFor) : null, [core, catalogue, scenarioFor]);
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
  useEffect(() => {
    void suitabilityRevision;
    if (!comparisonCore || !selected.length || !isMandatoryEligibilityReady() ||
        (catalogue.status !== 'unavailable' && (catalogue.status !== 'ready' || !catalogue.allLoaded))) return;
    const applicable = selected.filter(token => {
      const entry = resolveCompareSelections(comparisonCore, [token])[0];
      if (!entry) return false;
      const priced = resolvedPublicRankingRows([entry.row], catalogue,
        row => scenarioFor(entry.section, row)).rows;
      return entry.section === 'Mortgage'
        ? mortgageComparisonRows(priced, mortgageInputs, { core, details, manifest, coreIntegrity }).rows.length > 0
        : priced.length > 0;
    });
    if (applicable.length !== selected.length) setSelected(applicable);
  }, [comparisonCore, selected, catalogue, scenarioFor, mortgageInputs, core, details, manifest, coreIntegrity, suitabilityRevision, setSelected]);
  const debouncedQuery = useDebouncedValue(query, 120);
  const sortOptions = useMemo(() => availableSortOptions(section, mortgageRateMetric, depositRankMetric),
    [depositRankMetric, mortgageRateMetric, section]);
  const [filterOpen, setFilterOpen] = useBackOwnedSheetState(sheetNavigation);
  const [sortOpen, setSortOpen] = useBackOwnedSheetState(sheetNavigation);
  const [toolsOpen, setToolsOpen] = useBackOwnedSheetState(sheetNavigation);
  const [draftFilters, setDraftFilters] = useState<Filters>(filters);
  const [draftAvailability, setDraftAvailability] = useState<RateAvailability>(availability);
  const openFilters = useCallback(() => {
    setDraftAvailability(availability); setDraftFilters({ ...filters, includeNonStandard: task.includeNonStandardOverride ?? useStore.getState().prefs.includeNonStandard }); setFilterOpen(true);
  }, [availability, filters, setFilterOpen, task.includeNonStandardOverride]);
  const cancelFilters = useCallback(() => setFilterOpen(false), [setFilterOpen]);
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
  }, [draftAvailability, section, setFilterOpen]);
  const changeSection = useCallback((next: SectionKey) => {
    changeRatesSection(next); useStore.getState().setActiveSection(next);
    setFilterOpen(false); setSortOpen(false); setToolsOpen(false);
  }, [setFilterOpen, setSortOpen, setToolsOpen]);
  useEffect(() => {
    if (sortKey === 'comparison' && (section !== 'Mortgage' || mortgageRateMetric === 'comparison')) setSortKey('rate');
  }, [mortgageRateMetric, section, setSortKey, sortKey]);

  const fullPricingCandidates = useMemo(() => publicRecommendationRows(core?.sections[section]?.rates ?? [],
    catalogue, section, scenarioFor(section)), [core, catalogue, section, scenarioFor]);
  const resolvedCatalogueRows = useMemo(() => resolvedPublicRankingRows(fullPricingCandidates, catalogue, rowScenario).rows,
    [fullPricingCandidates, catalogue, rowScenario]);
  const pricingCandidates = useMemo(() => {
    void suitabilityRevision;
    return task.intentError ? [] : rowsForSearchScope(fullPricingCandidates, section, path, hierarchyScoped);
  }, [fullPricingCandidates, section, path, hierarchyScoped, task.intentError, suitabilityRevision]);
  const baseRows = useMemo(() => {
    void suitabilityRevision;
    return task.intentError ? [] : rowsForSearchScope(resolvedCatalogueRows, section, path, hierarchyScoped);
  }, [resolvedCatalogueRows, section, path, hierarchyScoped, task.intentError, suitabilityRevision]);
  const savedCatalogueRows = useMemo(() => {
    const candidates = publicRecommendationRows(core?.sections[section]?.rates ?? [], catalogue, section,
      publicRateScenario(section, scenario, prefs.profileFilters));
    return resolvedPublicRankingRows(candidates, catalogue,
      row => publicRateScenario(section, scenario, prefs.profileFilters, row)).rows;
  }, [core, catalogue, section, scenario, prefs.profileFilters]);
  const summaryCatalogueRows = catalogue.status === 'loading' || catalogue.status === 'error' ? null : savedCatalogueRows;
  const mortgageScope = useMemo(() => section === 'Mortgage' ? mortgageComparisonRows(baseRows, mortgageInputs,
    { core, details, manifest, coreIntegrity })
    : { rows: baseRows, unverified: 0, unverifiedRows: new WeakSet<RateRow>(), invalid: false },
    [baseRows, mortgageInputs, section, core, details, manifest, coreIntegrity]);
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
  // The matcher accepts an empty trimmed query without consulting the optional index.
  // Background index warming must not invalidate that result preparation or its viewport.
  const queryNeedsSearchIndex = deepSearchActive && debouncedQuery.trim().length > 0;
  const resultSearchIndex = queryNeedsSearchIndex ? searchIndex : null;
  const preparedResults = usePreparedSearchRows(mortgageScope.rows, resultFilters, sortKey, section,
    details?.products, resultSearchIndex, depositRankMetric, mortgageRateMetric,
    suitabilityRevision, isFocused);
  const rows = preparedResults.rows;
  const unverifiedResultCount = useMemo(() => rows.reduce((count, row) => count + (mortgageScope.unverifiedRows.has(row) ? 1 : 0), 0), [rows, mortgageScope.unverifiedRows]);
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
  const pageSize = normalizeRatesPageSize(prefs.ratesPageSize);
  const pagination = ratesPageWindow(resultRows.length, task.page, pageSize);
  const pageRows = useMemo(() => resultRows.slice(pagination.offset, pagination.to), [resultRows, pagination.offset, pagination.to]);
  const resultRowKey = useCallback((row: ResultRow, i: number) => ratesResultRowKey(row, pagination.offset + i), [pagination.offset]);
  const catalogueOptions = useMemo(() => ({ ...EMPTY_SEARCH_FILTER_OPTIONS,
    providers: [...new Set(unlistedEntries.map(item => item.provider).filter((value): value is string => Boolean(value)))].sort() }), [unlistedEntries]);
  const activeFilterOptions = draftAvailability === 'unlisted' ? catalogueOptions : filterOptions.options;

  const draftResultCount = useCallback(
    (draft: Filters) => (
      // Suitability rebuilds can keep the same row array; count against the gate the list uses.
      void suitabilityRevision,
      filterRows(
        mortgageScope.rows,
        { ...draft, query: debouncedQuery },
        details?.products ?? null,
        resultSearchIndex,
        section,
      ).length
    ),
    [mortgageScope.rows, debouncedQuery, details?.products, resultSearchIndex, section, suitabilityRevision],
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
    queryNeedsSearchIndex &&
    !searchIndex &&
    (searchIndexStatus === 'idle' || searchIndexStatus === 'loading');
  const searchIndexUnavailable =
    queryNeedsSearchIndex &&
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
    const update = toggleCompareSelection(comparisonCore!, selected, key);
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
  }, [core, comparisonCore, selected, setSelected]);

  const toggleCompareMode = useCallback(() => {
    hapticSelection();
    updateRatesSection(section, current => ({ selectMode: !current.selectMode, selected: [] }));
  }, [section]);
  const clearSearchFilters = useCallback(() => {
    if (section === 'Mortgage') clearMortgageComparison();
    updateRatesSection(section, { query: '', path: [], hierarchyScoped: false, intentError: null,
      filters: { ...EMPTY_FILTERS, includeNonStandard }, includeNonStandardOverride: null }, true);
  }, [includeNonStandard, section]);
  const intentPending = Boolean(intentKey && consumedIntent.current !== intentKey) || !session.initialized;
  const searchPending = intentPending || (availability === 'unlisted' ? !catalogueDetails : detailFiltersPending || searchIndexLoading || !preparedResults.ready);
  useEffect(() => {
    if (!searchPending && task.page !== pagination.page) updateRatesSection(section, { page: pagination.page }, true);
  }, [pagination.page, searchPending, section, task.page]);
  const dataTracker = useRef(new OpaquePerformanceAuditRenderRevision());
  const uiTracker = useRef(new OpaquePerformanceAuditRenderRevision());
  const listDataRevision = dataTracker.current.update([coreSha ?? core?.run_date ?? 'none', manifest?.files.details.sha256, catalogue.generationId, catalogue.status, scenario,
    section, path, hierarchyScoped, debouncedQuery, sortKey, effectiveFilters, availability, task.intentError,
    queryNeedsSearchIndex, resultSearchIndex != null, suitabilityRevision, resultRows.length, pagination.page, pageSize, mortgageInputs]);
  // Selection and disclosure changes need a fresh committed render, but keep
  // the same list and decoded logos while its result identities are unchanged.
  const listRevision = uiTracker.current.update([listDataRevision, filterOpen, draftFilters, draftAvailability, sortOpen, toolsOpen, selectMode, selected]);
  const listReadiness = useVirtualizedListReadiness(listRevision, pageRows.length);
  const { onCommitLayoutEffect: markListCommit, onLoad: markListLoad, onViewableItemsChanged: markListViewability } = listReadiness;
  const listRef = useRef<FlashListRef<ResultRow>>(null);
  const listLoaded = useRef(false);
  const [restoredDataRevision, setRestoredDataRevision] = useState<string | null>(null);
  type ViewabilityInfo = { viewableItems: { isViewable?: boolean | null; item: ResultRow; index?: number | null; key?: string }[] };
  const auditViewability = useRef<(info: ViewabilityInfo) => void>(() => {});
  const currentRows = useRef(pageRows);
  currentRows.current = pageRows;
  const restorationKey = JSON.stringify([listDataRevision, getRatesSessionRestoreRevision()]);
  // Initial native zero-offset events must not erase this list's requested restore.
  const restoration = useRef({ revision: restorationKey, section, offset: task.scrollOffset, scheduled: false, applied: false });
  if (restoration.current.revision !== restorationKey) {
    restoration.current = { revision: restorationKey, section, offset: task.scrollOffset, scheduled: false, applied: false };
  }
  const attachList = useCallback((list: FlashListRef<ResultRow> | null) => {
    if (listRef.current !== list) {
      listLoaded.current = false;
      restoration.current.scheduled = false;
      restoration.current.applied = false;
    }
    listRef.current = list;
  }, []);
  const restoreCommittedScroll = useCallback(() => {
    const list = listRef.current, pending = restoration.current;
    if (!listLoaded.current || !list || pending.scheduled || pending.applied) return;
    pending.scheduled = true;
    requestAnimationFrame(() => {
      if (listRef.current !== list || restoration.current !== pending || useRatesSession.getState().section !== pending.section) return;
      list.scrollToOffset({ offset: pending.offset, animated: false });
      // Wait for the native scroll to reach a frame before asking for current
      // viewport evidence. A measurement from before that move is insufficient.
      requestAnimationFrame(() => {
        if (listRef.current !== list || restoration.current !== pending || useRatesSession.getState().section !== pending.section) return;
        pending.applied = true;
        setRestoredDataRevision(pending.revision);
        list.recomputeViewableItems();
      });
    });
  }, []);
  useEffect(() => { restoreCommittedScroll(); }, [restorationKey, restoreCommittedScroll]);
  const onListCommit = useCallback(() => {
    markListCommit();
    restoreCommittedScroll();
  }, [markListCommit, restoreCommittedScroll]);
  const onListLoad = useCallback(() => {
    listLoaded.current = true;
    markListLoad();
    restoreCommittedScroll();
  }, [markListLoad, restoreCommittedScroll]);
  const onViewableItemsChanged = useCallback((info: ViewabilityInfo) => {
    if (!restoration.current.applied || info.viewableItems.some(token => token.isViewable === true && !currentRows.current.includes(token.item))) return;
    markListViewability(info);
    auditViewability.current(info);
  }, [markListViewability]);
  useEffect(() => {
    // In-place selection/disclosure changes do not change visible indices, so
    // FlashList may omit its usual viewability callback. Request a fresh native
    // measurement after this render commits; layout alone is not visible proof.
    if (listReadiness.ready) listRef.current?.recomputeViewableItems();
  }, [listRevision, listReadiness.ready]);
  const logoReadiness = useLogoReadiness(listDataRevision);
  const auditTarget = useRatesAuditTarget({ rows: pageRows, results: resultRows, page: pagination.page, size: pageSize,
    revision: listRevision, context: JSON.stringify([coreSha ?? core?.run_date, manifest?.files.details.sha256, catalogue.generationId, catalogue.status, scenario,
      section, path, hierarchyScoped, debouncedQuery, sortKey, effectiveFilters, availability, pageSize, mortgageInputs, getRatesSessionRestoreRevision()]),
    selectMode, canScroll: restoredDataRevision === restorationKey && listReadiness.ready, list: listRef,
    token: row => 'product_key' in row ? rowToken(row) : null,
    key: resultRowKey,
    navigate: page => {
      if (page !== pagination.page || !selectMode) updateRatesSection(section, { page, selectMode: true }, page !== pagination.page);
    },
  });
  const { isVisible: isAuditTargetVisible, selectionFinished: finishAuditTargetSelection, prepare: prepareAuditTarget } = auditTarget;
  auditViewability.current = auditTarget.onViewableItemsChanged;
  const surfaceTracker = useRef(new OpaquePerformanceAuditRenderRevision());
  const surfaceRevision = surfaceTracker.current.update([listRevision, auditTarget.cellRevision, auditTarget.viewport]);
  const selectAuditToken = useCallback((...args: unknown[]) => {
    const token = auditActionString(args, 'selectionToken');
    const row = token ? pageRows.find(row => 'product_key' in row && rowToken(row) === token) : undefined;
    if (!row) {
      return { unavailableReason: 'The selected exact rate is not on the rendered results page' };
    }
    if (!selectMode) return { unavailableReason: 'Comparison selection is not active' };
    if (!isAuditTargetVisible(row)) return { unavailableReason: 'The selected exact rate is not committed and visible' };
    toggleSelect(token!);
    finishAuditTargetSelection(row);
  }, [isAuditTargetVisible, finishAuditTargetSelection, pageRows, selectMode, toggleSelect]);
  const prepareAuditComparePage = useCallback((...args: unknown[]) =>
    prepareAuditTarget(auditActionString(args, 'selectionToken') ?? '',
      (args[1] as { signal?: AbortSignal } | undefined)?.signal), [prepareAuditTarget]);
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
    'search.compare.page.0': prepareAuditComparePage,
    'search.compare.select.0': selectAuditToken,
    'search.compare.page.1': prepareAuditComparePage,
    'search.compare.select.1': selectAuditToken,
    'search.compare.open': (...args: unknown[]) => {
      const exactTokens = auditActionStrings(args, 'selectionTokens');
      const tokens = exactTokens.length >= 2 ? exactTokens : selected;
      if (tokens.length >= 2) openCompare(tokens);
    },
  }), [applyFilters, cancelFilters, changeSection, clearSearchFilters, draftFilters, filterOpen, openFilters, prepareAuditComparePage, section, selected, selectAuditToken, setQuery, setSortKey, setSortOpen, sortOptions, toggleCompareMode]);
  const renderProduct = useCallback(({ item, target }: { item: ResultRow; target?: string }) => 'product_key' in item ? (
    <SearchProductRow row={item} section={section} onLogoRenderStateChange={logoReadiness.onLogoRenderStateChange}
      rateScenario={rowScenario(item)} comparisonUnverified={section === 'Mortgage' && mortgageScope.unverifiedRows.has(item)}
      auditCell={target === 'Cell'} auditRevision={listRevision} onAuditCellCommit={auditTarget.onCellCommit}
      selectMode={selectMode} selected={selected.includes(rowToken(item))} onToggleSelect={toggleSelect} />
  ) : <TouchTarget fill onPress={() => openProduct(item.key)} accessibilityRole="button"
      accessibilityLabel={uiProductName({product_name:item.name??''})} style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <AppText variant="body" weight="600">{uiProductName({product_name:item.name??''})}</AppText>
      <AppText variant="small" color="textMuted">{uiJoin(uiProviderName({provider:item.provider??''}),' · ',humanizeEnum(item.productCategory??''))}</AppText>
      <AppText variant="small" color="textMuted">{uiLabel("No listed rate")}</AppText>
    </TouchTarget>, [auditTarget.onCellCommit, listRevision, section, logoReadiness.onLogoRenderStateChange, selectMode, selected, toggleSelect, theme.colors.border, mortgageScope.unverifiedRows, rowScenario]);
  usePerformanceAuditSurface({
    id: 'rates.results',
    routeKey: '/browse',
    datasetRevision: coreSha ?? core?.run_date ?? null,
    renderRevision: surfaceRevision,
    actions: auditActions,
    probes: [
      auditTarget.targetProbe,
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
          (pageRows.length > 0 && (listReadiness.measuredVisibleCount ?? 0) === 0) ? 'pending' : 'ready',
        expectedCount: pageRows.length,
        actualCount: listReadiness.committedItemCount,
        // A committed empty data set has no product rows even if FlashList
        // omits its empty viewability callback. Non-empty views require it.
        visibleCount: pageRows.length === 0 && listReadiness.ready ? 0 : listReadiness.measuredVisibleCount,
        emptyStateRendered: pageRows.length === 0 && !searchPending && listReadiness.ready,
      },
      {
        id: 'search.layout',
        kind: 'layout',
        status: listReadiness.ready ? 'ready' : 'pending',
        layoutMeasured: listReadiness.ready,
        renderRevision: surfaceRevision,
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
  }, isFocused);

  if (!core || intentPending) return <ScreenSkeleton />;
  const filterCount = availability === 'unlisted' ? filters.providers.length : activeFilterCount(effectiveFilters);
  const sortLabel = availability === 'unlisted' ? 'All product types · No listed rate' : sortOptions.find(option => option.key === sortKey)?.label ?? 'Rate';
  const compactSortLabel = sortLabel === 'Comparison rate' ? uiLabel('Comparison')
    : sortLabel === 'Advertised rate' ? uiLabel('Advertised')
      : sortLabel === 'Ongoing rate' ? uiLabel('Ongoing')
        : sortLabel === 'Headline rate' ? uiLabel('Headline')
          : sortLabel === 'Bank A–Z' ? uiLabel('Bank') : sortLabel;
  const quickSortKey = sortKey === 'bank' ? 'rate' : 'bank';
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Rates' }} />
      <View style={{ flex: 1 }} onLayout={listReadiness.onRevisionLayout}>
        <View testID="rates-task-controls" style={{ ...screenScrollContentStyle(theme, 0, width), gap: 8, paddingTop: 8, paddingBottom: 8 }}>
            <SegmentedControl options={sectionOptions} value={section} onChange={changeSection} />
            <SearchBar value={uiRatesQuery(task)} onChangeText={setQuery} placeholder="Search" accessibilityLabel="Search rates or banks" />
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              <IconAction icon="options" word="Filter" badge={filterCount || undefined}
                accessibilityLabel={filterCount ? uiJoin('Temporary filters', ' (', uiCount(filterCount), ')') : uiLabel('Temporary filters')}
                accessibilityState={{ expanded: filterOpen }} active={filterCount > 0} onPress={openFilters} />
              <IconAction icon="swap-vertical" word="Sort" onPress={() => setSortOpen(true)}
                accessibilityState={{ expanded: sortOpen }} disabled={availability === 'unlisted'} />
              <IconAction icon={selectMode ? 'checkmark-circle' : 'git-compare'} word={selectMode ? 'Done' : 'Compare'}
                active={selectMode} accessibilityState={{ selected: selectMode }}
                onPress={toggleCompareMode} disabled={availability === 'unlisted'} />
              <IconAction icon="business-outline" word="Bank" accessibilityLabel="Bank A–Z"
                active={sortKey === 'bank'} accessibilityState={{ selected: sortKey === 'bank' }}
                disabled={availability === 'unlisted'} onPress={() => setSortKey(quickSortKey)} />
              <IconAction icon="ellipsis-horizontal" word="More" onPress={() => setToolsOpen(true)}
                accessibilityLabel="Search actions" accessibilityState={{ expanded: toolsOpen }} />
            </Row>
            <View style={{ width: '100%', flexShrink: 0, gap: 2 }}>
              <AppText variant="tiny" color="textMuted">{uiJoin(searchPending ? 'Loading':uiJoin(uiCount(resultRows.length),' ',availability === 'listed' ? 'rates' : 'products'),searchSub?uiJoin(' · ','Alert on'):null)}</AppText>
              <AppText variant="tiny" color="textMuted" accessibilityLabel={sortLabel}>{compactSortLabel}</AppText>
            </View>
            {path.length ? <Button title="Clear scope" variant="ghost" onPress={() => updateRatesSection(section, { path: [], hierarchyScoped: false }, true)} /> : null}
            {searchIndexUnavailable ? <Row><AppText variant="tiny" color="textMuted">{uiLabel("Name search")}</AppText>
              {searchIndexStatus === 'error' ? <Button title="Retry search" variant="ghost" onPress={() => void ensureSearchIndex()} /> : null}</Row> : null}
        </View>
        {/* Keep the recycler's native measurement origin at zero beneath the
            fixed controls; a sibling offset otherwise corrupts its visible range. */}
        <View style={{ flex: 1 }}>
        <FlashList
          ref={attachList}
          drawDistance={120}
          // Keep the list mounted while the fixed task controls change results.
          // Session state owns offsets; automatic item anchoring would compete.
          maintainVisibleContentPosition={{ disabled: true }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          data={pageRows}
          ListHeaderComponent={availability === 'listed' ? <View style={{ gap: 8 }}>
            <SavedRequirementsSummary section={section} catalogueRows={summaryCatalogueRows} />
            {catalogue.status !== 'unavailable' ? <><PublicPricingCoverage section={section} rows={pricingCandidates} scenario={scenario} scenarioForRow={rowScenario} compact />
              <PublicProductDiscovery section={section} rateScenario={scenarioFor(section)} rows={baseRows} query={debouncedQuery} /></> : null}
            {section === 'Mortgage' ? <MortgageComparisonControls catalogue={catalogue} rows={core.sections.Mortgage.rates} filters={filters}
              unverified={unverifiedResultCount} invalid={mortgageScope.invalid} /> : null}
          </View> : null}
          ListFooterComponent={<RatesPagination total={resultRows.length} page={pagination.page} size={pageSize}
            noun={availability === 'listed' ? 'rates' : 'products'} pending={searchPending}
            onPage={page => updateRatesSection(section, { page }, true)}
            onSize={size => useStore.getState().setPref('ratesPageSize', size)} />}
          onCommitLayoutEffect={onListCommit}
          onLoad={onListLoad}
          onContentSizeChange={listReadiness.onContentSizeChange}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 1, minimumViewTime: 16 }}
          extraData={listRevision}
          keyExtractor={resultRowKey}
          getItemType={item => 'product_key' in item ? 'rate' : 'unlisted'}
          onScroll={event => {
            if (restoration.current.applied && restoration.current.revision === restorationKey
              && useRatesSession.getState().section === section) recordRatesScroll(section, event.nativeEvent.contentOffset.y);
          }}
          scrollEventThrottle={64}
          contentContainerStyle={{
            ...screenScrollContentStyle(theme, 0, width),
            // Fixed task controls own their spacing; rows stay adjacent.
            gap: 0,
            paddingTop: 0,
            paddingBottom: theme.spacing(6),
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
                  title="Reset Rates view"
                  variant="secondary"
                  onPress={clearSearchFilters}
                />
                <Button title="Edit saved requirements" variant="ghost" onPress={() => router.push('/profile')} />
              </View>
            )
          }
        />
        </View>
      </View>

      {selectMode && selected.length >= 2 ? (
        <CompareDock
          count={selected.length}
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
        {draftAvailability === 'listed' ? <SavedRequirementsSummary section={section} catalogueRows={summaryCatalogueRows}
          onEdit={() => { setFilterOpen(false); router.push('/profile'); }} /> : null}
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
          <Button title="Cancel" variant="ghost" onPress={() => setSortOpen(false)} />
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

function CompareDock({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  const theme = useTheme();
  const label=uiJoin('Compare',' ',uiCount(count));

  return (
    <View testID="rates-compare-dock" style={{
      flexShrink: 0,
      paddingHorizontal: theme.spacing(4),
      paddingVertical: theme.spacing(2),
      backgroundColor: theme.colors.surface,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    }}>
      <TouchTarget
        fill
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => ({
          backgroundColor: theme.colors.primary,
          borderRadius: theme.radius.pill,
          minHeight: 56,
          paddingVertical: theme.spacing(2),
          paddingHorizontal: theme.spacing(5),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing(2),
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons name="git-compare" size={24} color={theme.colors.onPrimary} />
        <AppText variant="body" weight="800" style={{ color: theme.colors.onPrimary }}>
          {label}
        </AppText>
      </TouchTarget>
    </View>
  );
}
