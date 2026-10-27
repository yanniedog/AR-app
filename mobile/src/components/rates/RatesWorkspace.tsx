import { PreparedProductCard } from './PreparedProductCard';
import { useMortgageResultsIndex } from '../../hooks/useMortgageResultsIndex';
import { profileSectionCount } from '../../data/profile';
import { checkDrillOutcome } from '../../lib/degradationLog';
import { reconcilePublicCompareSelectionTokens } from '../../data/publicCompareSelectionTokens';
import { publicScenarioForRow } from '../../data/publicRateIntegration';
import { mortgageComparisonScenario } from '../../data/mortgageComparisonScenario';
import type { RateScenario } from '../../data/publicRateModel';
import { ratesResultRowKey } from '../../data/ratesResultRowKey';
import { publicOfferSelectionToken } from '../../data/publicOfferIdentity';
import { PublicPricingCoverage, PublicProductDiscovery } from '../scenario/PublicPricingCoverage';
import { usePublicRateCatalogue } from '../../data/publicRateCatalogue';
import { publicRateScenario, resolvedPublicRankingRows } from '../../data/publicRateIntegration';
import { useUserRateScenario } from '../../hooks/useUserRateScenario';
import { useResolvedPublicRankingRows } from '../../hooks/useResolvedPublicRankingRows';
import { uiCount,uiJoin,uiLabel,uiRatesQuery,uiProductName,uiProviderName,type UiCopy } from '../../lib/uiCopy';
import { humanizeEnum } from '../../data/format';
import { useReadyNavigationEffect } from '../../hooks/useReadyNavigationEffect';
import { useBackOwnedSheetState } from '../../hooks/useBackOwnedSheetState';
import { SheetSurface, type SheetAuditState } from '../SheetSurface';
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
import { usePhysicalListVisibility } from '../../hooks/usePhysicalListVisibility';
import { measuredRatesViewport } from '../../lib/ratesViewport';
import { countItemsCooperatively } from '../../lib/cooperativeCount';
import { SearchReportExport } from '../../components/SearchReportExport';
import { isSuitabilityFilterReady } from '../../data/suitabilityGate';
import Ionicons from '../../components/icons/AppIcon';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { FLASH_LIST_DRAW_DISTANCE, FLASH_LIST_VIEWABILITY_CONFIG } from '../../lib/flashListDefaults';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, useWindowDimensions, View } from 'react-native';

import { FilterSheet } from '../../components/FilterSheet';
import { SavedRequirementsSummary } from '../SavedRequirementsSummary';
import { RatesPagination } from '../RatesPagination';
import { MortgageComparisonControls } from '../MortgageComparisonControls';
import {
  useMortgageComparison,
  mortgageComparisonRows,
  mortgageComparisonCriteriaReady,
  mortgageComparisonInputsInvalid,
  clearMortgageComparison,
} from '../../data/mortgageComparison';
import { EmptyState, IndeterminateProgressBar, LoadingRows, ScreenSkeleton } from '../../components/feedback';
import { IconAction } from '../../components/IconAction';
import { Screen, screenScrollContentStyle } from '../../components/Screen';
import { SearchBar } from '../../components/controls';
import { AppText, Button, Row } from '../../components/ui';
import { SECTION_ORDER } from '../../constants';
import {
  activeFilterCount,
  EMPTY_FILTERS,
  filterRowsCooperatively,
  type Filters,
  type SortKey,
} from '../../data/selectors';
import { ensurePermissions } from '../../data/notifications';
import { resolveCompareSelections, toggleCompareSelection } from '../../data/compareSelection';
import { hasMandatoryRequirements, isMandatoryEligibilityReady, mandatoryEligibleRows } from '../../data/eligibilityGate';
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
import { scheduleAfterInteractions, scheduleAfterNavigation } from '../../lib/yieldToUi';
import type { CorePayload, RateRow, SectionKey } from '../../types';
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

const EMPTY_RATE_ROWS: RateRow[] = [];
const rowToken = (r: RateRow) => r.public_offer_id ? publicOfferSelectionToken(r.product_key, r.public_offer_id) :
  r.rate_index == null ? r.product_key : `${r.rate_index}#${r.product_key}`;

const SearchProductRow = React.memo(function SearchProductRow({ row, section, selectMode, selected, selectionToken, onToggleSelect,
  onLogoRenderStateChange, comparisonUnverified, rateScenario, quoteOwner, auditCell, auditRevision, onAuditCellCommit }: {
  row: RateRow; section: SectionKey; selectMode: boolean; selected: boolean; selectionToken: string;
  onToggleSelect: (token: string) => void;
  onLogoRenderStateChange?: (id: string, state: LogoRenderState) => void;
  comparisonUnverified: boolean; rateScenario: RateScenario; quoteOwner?: object | null;
  auditCell: boolean; auditRevision: string;
  onAuditCellCommit: (row: RateRow, revision: string) => () => void;
}) {
  useLayoutEffect(() => auditCell ? onAuditCellCommit(row, auditRevision) : undefined,
    [auditCell, auditRevision, onAuditCellCommit, row]);
  const onPress = useCallback(() => selectMode ? onToggleSelect(selectionToken) : openProduct(row.product_key, row.rate_index, row.public_programme_id, 'rates-comparison'),
    [selectMode, onToggleSelect, row, selectionToken]);
  return <PreparedProductCard quoteOwner={quoteOwner} row={row} section={section} comparisonUnverified={comparisonUnverified} rateScenario={rateScenario}
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
  useLayoutEffect(() => {
    if (!core) return;
    const next = reconcilePublicCompareSelectionTokens(core, catalogue, task.selected);
    if (next.length !== task.selected.length || next.some((token, index) => token !== task.selected[index])) {
      updateRatesSection(section, { selected: next });
    }
  }, [core, catalogue, section, task.selected]);
  const { scenario } = useUserRateScenario();
  // Amount/LVR typing is debounced inside MortgageComparisonControls before the
  // store updates. Audit/programmatic applies write the store immediately so
  // readiness waits on cooperative pricing rather than a second 200ms delay.
  const mortgageInputs = useMortgageComparison();
  const mortgageFilters = session.sections.Mortgage.filters;
  // Do not price/filter the full Mortgage catalogue until LVR + purpose + repayment
  // are set. Empty criteria previously ran an identity pass over every row.
  const mortgageCriteriaReady = section !== 'Mortgage'
    || mortgageComparisonCriteriaReady(mortgageInputs, mortgageFilters);
  const mortgageInputsInvalid = section === 'Mortgage' && mortgageComparisonInputsInvalid(mortgageInputs);
  // Prepare the common facet combination while fields are edited, without
  // selecting it for the user or exposing results before actual criteria exist.
  const pricingFacetsKey = JSON.stringify({
    loanPurposes: mortgageFilters.loanPurposes.length ? mortgageFilters.loanPurposes : ['OWNER_OCCUPIED'],
    repaymentTypes: mortgageFilters.repaymentTypes.length ? mortgageFilters.repaymentTypes : ['PRINCIPAL_AND_INTEREST'],
  });
  const pricingMortgageFilters = useMemo(() => JSON.parse(pricingFacetsKey) as Pick<Filters, 'loanPurposes' | 'repaymentTypes'>, [pricingFacetsKey]);
  const mortgagePricingReady = section !== 'Mortgage' || mortgageComparisonCriteriaReady(mortgageInputs, pricingMortgageFilters);
  const preparingMortgageDefaults = section === 'Mortgage' && !mortgageCriteriaReady && mortgagePricingReady;
  const scenarioFor = useMemo(() => {
    // Only term fields vary by row in comparison scenarios. Normalize private
    // inputs/facets once per term, rather than once per catalogue occurrence.
    const bases = new Map<string, RateScenario>();
    return (selected: SectionKey, row?: RateRow) => {
      const key = JSON.stringify([selected, row?.term_months, row?.term]);
      let base = bases.get(key);
      if (!base) {
        base = mortgageComparisonScenario(selected, publicRateScenario(selected, scenario, prefs.profileFilters, row), mortgageInputs, pricingMortgageFilters);
        if (bases.size >= 64) bases.delete(bases.keys().next().value!);
        bases.set(key, base);
      }
      return publicScenarioForRow(row, catalogue, base);
    };
  }, [catalogue, scenario, prefs.profileFilters, mortgageInputs, pricingMortgageFilters]);
  const rowScenario = useCallback((row: RateRow) => scenarioFor(section, row), [scenarioFor, section]);
  const previousMortgageInputs = useRef(mortgageInputs);
  const previousMortgageFacets = useRef({
    loanPurposes: mortgageFilters.loanPurposes.join('\0'),
    repaymentTypes: mortgageFilters.repaymentTypes.join('\0'),
  });
  useEffect(() => {
    const previous = previousMortgageInputs.current;
    previousMortgageInputs.current = mortgageInputs;
    const nextFacets = {
      loanPurposes: mortgageFilters.loanPurposes.join('\0'),
      repaymentTypes: mortgageFilters.repaymentTypes.join('\0'),
    };
    const previousFacets = previousMortgageFacets.current;
    previousMortgageFacets.current = nextFacets;
    const inputsChanged = previous.loanAmount !== mortgageInputs.loanAmount
      || previous.lvr !== mortgageInputs.lvr;
    const facetsChanged = previousFacets.loanPurposes !== nextFacets.loanPurposes
      || previousFacets.repaymentTypes !== nextFacets.repaymentTypes;
    if (!inputsChanged && !facetsChanged) return;
    // Always reset Mortgage paging/scroll for a committed amount/LVR/facet change,
    // including when the user is temporarily on another section.
    const mortgage = useRatesSession.getState().sections.Mortgage;
    if (mortgage.page === 1 && mortgage.scrollOffset === 0) return;
    updateRatesSection('Mortgage', { page: 1, scrollOffset: 0 }, true);
  }, [mortgageInputs, mortgageFilters.loanPurposes, mortgageFilters.repaymentTypes]);
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
    // Claim details on the next idle turn for every section, including Mortgage
    // before LVR is set. The list does not wait on this load while comparison
    // criteria are incomplete. A navigation-sized delay left cold Rates with
    // details neither loaded nor loading.
    return scheduleAfterInteractions(() => {
      void ensureDetails({ force: true });
    });
  }, [ensureDetails, coreKey, detailsKey, isFocused]);
  useEffect(() => {
    if (!isFocused || !deepSearchActive) return;
    // Index warming stays on the navigation deferral. Running it on the idle
    // turn forced a search-index pass during the first results paint.
    if (section === 'Mortgage' && task.availability !== 'unlisted' && !mortgageCriteriaReady) return;
    return scheduleAfterNavigation(() => {
      void ensureSearchIndex();
    });
  }, [deepSearchActive, ensureSearchIndex, coreKey, detailsKey, searchIndexSha, isFocused, section, mortgageCriteriaReady, task.availability]);
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
  const selectionTokenFor = useCallback((row: RateRow) => {
    const legacy = row.rate_index == null ? row.product_key : `${row.rate_index}#${row.product_key}`;
    // Keep an existing occurrence selected/removable until all product routes
    // settle. This does not associate it with the first loaded public offer.
    return !catalogue.allLoaded && row.rate_index != null && selected.includes(legacy) ? legacy : rowToken(row);
  }, [catalogue.allLoaded, selected]);
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

  const sectionScenario = useMemo(() => scenarioFor(section), [scenarioFor, section]);
  const mortgageContext = useMemo(() => ({ core, details, manifest, coreIntegrity }),
    [core, details, manifest, coreIntegrity]);
  const sourceRates = core?.sections[section]?.rates ?? EMPTY_RATE_ROWS;
  // Unlisted Mortgage browse has no comparison controls; do not gate it behind LVR/purpose/repayment.
  const mortgageSearchActive = section !== 'Mortgage' || availability === 'unlisted' || mortgageCriteriaReady;
  const pricingActive = mortgageSearchActive || section === 'Mortgage' && availability === 'listed' && mortgagePricingReady;
  const mortgageIndex = useMortgageResultsIndex(core?.sections.Mortgage.rates ?? EMPTY_RATE_ROWS,
    catalogue, mortgageContext, task.includeNonStandardOverride ?? includeNonStandard, suitabilityRevision, isFocused);
  const indexedScenarioKey = JSON.stringify(sectionScenario), indexedInputsKey = JSON.stringify(mortgageInputs);
  const indexedPricing = useMemo(() => section === 'Mortgage' && !task.intentError && mortgagePricingReady &&
    pricingMortgageFilters.loanPurposes.length === 1 && pricingMortgageFilters.repaymentTypes.length === 1
    ? mortgageIndex.index?.select(JSON.parse(indexedScenarioKey), JSON.parse(indexedInputsKey)) ?? null : null,
  [section, task.intentError, mortgagePricingReady, pricingMortgageFilters.loanPurposes.length, pricingMortgageFilters.repaymentTypes.length,
    mortgageIndex.index, indexedScenarioKey, indexedInputsKey]);
  const cooperativePricing = useResolvedPublicRankingRows({
    sourceRows: task.intentError || !pricingActive || indexedPricing ? EMPTY_RATE_ROWS : sourceRates,
    // Empty sourceRows alone still expands catalogue offers. Pass an explicit
    // empty candidate set while Mortgage criteria are incomplete so Rates does
    // not sync-scan the full-day book on every render.
    candidates: task.intentError || !pricingActive || indexedPricing ? EMPTY_RATE_ROWS : null,
    catalogue,
    section,
    sectionScenario,
    rowScenario,
    mortgageInputs,
    mortgageContext,
    applyMortgageScope: section === 'Mortgage' && mortgagePricingReady,
    focused: isFocused && pricingActive && !indexedPricing,
    interactive: isFocused,
    revision: suitabilityRevision,
    prepareMortgageIndex: false,
    resolutionContextKey: JSON.stringify([scenario, prefs.profileFilters, pricingMortgageFilters.loanPurposes, pricingMortgageFilters.repaymentTypes]),
  });
  const publicPricing = indexedPricing ? {
    ...cooperativePricing, candidates: indexedPricing.candidates,
    resolution: { rows: indexedPricing.priced, priced: indexedPricing.priced.length,
      unresolved: Math.max(0, indexedPricing.candidates.length - indexedPricing.priced.length), complete: catalogue.allLoaded },
    mortgageScope: indexedPricing.rawScope, ready: true, error: null,
    work: { ...cooperativePricing.work, pricingStage: 'ready' as const, sourceRowCount: sourceRates.length,
      candidateCount: indexedPricing.candidates.length, pricedRowCount: indexedPricing.priced.length },
  } : cooperativePricing;
  const fullPricingCandidates = publicPricing.candidates;
  const discoveryKeys = useMemo(() => {
    void suitabilityRevision;
    if (!hasMandatoryRequirements()) return new Set(catalogue.products.filter(product => product.section === section).map(product => product.productKey));
    if (!isMandatoryEligibilityReady() || !publicPricing.ready) return new Set<string>();
    return new Set(mandatoryEligibleRows(publicPricing.resolution.rows).map(row => row.product_key));
  }, [catalogue, section, suitabilityRevision, publicPricing.ready, publicPricing.resolution.rows]);
  const resolvedCatalogueRows = publicPricing.resolution.rows;
  // Reuse cooperative candidates for compare selection — never re-expand the
  // full-day catalogue on the render path (that stalled search.data readiness).
  const comparisonCore = useMemo((): CorePayload | null => {
    if (!core) return null;
    if (catalogue.status === 'unavailable' || !publicPricing.ready) return core;
    if (section === 'Mortgage' && !mortgageCriteriaReady) return core;
    return {
      ...core,
      sections: {
        ...core.sections,
        [section]: {
          ...core.sections[section],
          rates: fullPricingCandidates,
        },
      },
    };
  }, [core, catalogue.status, section, fullPricingCandidates, publicPricing.ready, mortgageCriteriaReady]);
  const pricingCandidates = useMemo(() => {
    void suitabilityRevision;
    return task.intentError || !pricingActive ? []
      : indexedPricing && !path.length && !hierarchyScoped ? indexedPricing.mandatoryCandidates
      : rowsForSearchScope(fullPricingCandidates, section, path, hierarchyScoped);
  }, [fullPricingCandidates, section, path, hierarchyScoped, task.intentError, suitabilityRevision, pricingActive, indexedPricing]);
  const baseRows = useMemo(() => {
    void suitabilityRevision;
    return task.intentError || !pricingActive ? []
      : indexedPricing && !path.length && !hierarchyScoped ? indexedPricing.mandatoryQuotes
      : rowsForSearchScope(resolvedCatalogueRows, section, path, hierarchyScoped);
  }, [resolvedCatalogueRows, section, path, hierarchyScoped, task.intentError, suitabilityRevision, pricingActive, indexedPricing]);
  // Saved-requirements matching uses the profile scenario, not exploratory
  // amount/LVR. Reuse list pricing when those inputs are empty; otherwise resolve
  // the profile catalogue cooperatively so Rates open stays off the sync path.
  // Wait until list pricing settles so mortgage.scope.apply does not run two
  // full-day catalogue passes on the same event-loop budget.
  const exploratoryMortgageActive = section === 'Mortgage' && mortgageCriteriaReady;
  const profileSectionScenario = useMemo(
    () => publicRateScenario(section, scenario, prefs.profileFilters),
    [section, scenario, prefs.profileFilters],
  );
  const profileRowScenario = useCallback(
    (row: RateRow) => publicRateScenario(section, scenario, prefs.profileFilters, row),
    [section, scenario, prefs.profileFilters],
  );
  const needsProfilePricing = exploratoryMortgageActive && profileSectionCount(prefs.profileFilters, section) > 0 && !task.intentError;
  const profilePricing = useResolvedPublicRankingRows({
    sourceRows: needsProfilePricing ? sourceRates : EMPTY_RATE_ROWS,
    candidates: needsProfilePricing ? null : EMPTY_RATE_ROWS,
    catalogue,
    section,
    sectionScenario: profileSectionScenario,
    rowScenario: profileRowScenario,
    focused: isFocused && needsProfilePricing && publicPricing.ready,
    interactive: isFocused,
    revision: suitabilityRevision,
  });
  useEffect(() => {
    void suitabilityRevision;
    // Wait for cooperative list pricing so tray pruning cannot race scope apply.
    if (!publicPricing.ready || !comparisonCore || !selected.length || !isMandatoryEligibilityReady() ||
        (catalogue.status !== 'unavailable' && (catalogue.status !== 'ready' || !catalogue.allLoaded))) return;
    // A layout reconciliation may already have upgraded legacy aliases. Do
    // not overwrite that newer selection from this render's passive effect.
    if (useRatesSession.getState().sections[section].selected !== selected) return;
    const canonical = core ? reconcilePublicCompareSelectionTokens(core, catalogue, selected) : selected;
    const applicable = canonical.filter(token => {
      const entry = resolveCompareSelections(comparisonCore, [token])[0];
      if (!entry) return false;
      // Keep Mortgage compare selections while criteria are incomplete so
      // clearing LVR/purpose/repayment does not wipe the tray.
      if (entry.section === 'Mortgage' && !mortgageCriteriaReady) return true;
      const priced = resolvedPublicRankingRows([entry.row], catalogue,
        row => scenarioFor(entry.section, row)).rows;
      return entry.section === 'Mortgage'
        ? mortgageComparisonRows(priced, mortgageInputs, { core, details, manifest, coreIntegrity }).rows.length > 0
        : priced.length > 0;
    });
    if (applicable.length !== selected.length || applicable.some((token, index) => token !== selected[index])) setSelected(applicable);
  }, [comparisonCore, selected, catalogue, scenarioFor, mortgageInputs, mortgageCriteriaReady, core, details, manifest, coreIntegrity, suitabilityRevision, setSelected, section, publicPricing.ready]);
  const summaryCatalogueRows = catalogue.status === 'unavailable' || (catalogue.status === 'ready' && catalogue.allLoaded)
    ? (exploratoryMortgageActive
      ? (profilePricing.ready ? profilePricing.resolution.rows : null)
      : (publicPricing.ready ? resolvedCatalogueRows : null))
    : null;
  const mortgageScope = useMemo(() => {
    if (section !== 'Mortgage') {
      return { rows: baseRows, unverified: 0, unverifiedRows: new WeakSet<RateRow>(), invalid: false };
    }
    if (!mortgagePricingReady) {
      return {
        rows: [] as RateRow[],
        unverified: 0,
        unverifiedRows: new WeakSet<RateRow>(),
        invalid: mortgageInputsInvalid,
      };
    }
    if (indexedPricing && !path.length && !hierarchyScoped) return indexedPricing.scope;
    // Preserve the completed scope identity when no hierarchy/mandatory gate
    // narrowed it. Rebuilding an identical array here discarded warm filtering.
    if (baseRows === resolvedCatalogueRows) return publicPricing.mortgageScope;
    // Scope was applied to the full priced catalogue; re-apply hierarchy/path.
    const scoped = new Set(baseRows);
    const rows = publicPricing.mortgageScope.rows.filter(row => scoped.has(row));
    const unverifiedRows = new WeakSet<RateRow>();
    let unverified = 0;
    for (const row of rows) {
      if (publicPricing.mortgageScope.unverifiedRows.has(row)) {
        unverifiedRows.add(row);
        unverified += 1;
      }
    }
    return { rows, unverified, unverifiedRows, invalid: publicPricing.mortgageScope.invalid };
  }, [section, baseRows, publicPricing.mortgageScope, resolvedCatalogueRows, mortgagePricingReady, mortgageInputsInvalid, indexedPricing, path.length, hierarchyScoped]);

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      includeNonStandard: task.includeNonStandardOverride ?? includeNonStandard,
    }),
    [filters, includeNonStandard, task.includeNonStandardOverride],
  );

  const resultFilters = useMemo(() => ({ ...effectiveFilters, query: debouncedQuery,
    ...(preparingMortgageDefaults ? { loanPurposes: pricingMortgageFilters.loanPurposes, repaymentTypes: pricingMortgageFilters.repaymentTypes } : {}) }),
    [effectiveFilters, debouncedQuery, preparingMortgageDefaults, pricingMortgageFilters.loanPurposes, pricingMortgageFilters.repaymentTypes]);
  // The matcher accepts an empty trimmed query without consulting the optional index.
  // Background index warming must not invalidate that result preparation or its viewport.
  const queryNeedsSearchIndex = deepSearchActive && debouncedQuery.trim().length > 0;
  const resultSearchIndex = queryNeedsSearchIndex ? searchIndex : null;
  const indexedRows = useMemo(() => indexedPricing && !path.length && !hierarchyScoped
    ? indexedPricing.filtered(resultFilters, sortKey, mortgageRateMetric) : null,
  [indexedPricing, path.length, hierarchyScoped, resultFilters, sortKey, mortgageRateMetric]);
  const cooperativeResults = usePreparedSearchRows(indexedRows ? EMPTY_RATE_ROWS : mortgageScope.rows, resultFilters, sortKey, section,
    details?.products, resultSearchIndex, depositRankMetric, mortgageRateMetric,
    suitabilityRevision, isFocused && !indexedRows);
  const preparedResults = indexedRows ? { ...cooperativeResults, rows: indexedRows, ready: true, error: null } : cooperativeResults;
  const rows = preparedResults.rows;
  // Ancillary facet inventories must not compete with the matching-result
  // pipeline while the current pricing/filter request is still unresolved.
  const filterOptions = useSearchFilterOptions(
    mortgageSearchActive ? baseRows : EMPTY_RATE_ROWS,
    mortgageSearchActive ? details?.products : undefined,
    section, suitabilityRevision, publicPricing.ready && preparedResults.ready,
  );
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
  const resultRows: ResultRow[] = availability === 'unlisted' ? unlistedRows : section === 'Mortgage' && !mortgageCriteriaReady ? EMPTY_RATE_ROWS : rows;
  const pageSize = normalizeRatesPageSize(prefs.ratesPageSize);
  const pagination = ratesPageWindow(resultRows.length, task.page, pageSize);
  const pageRows = useMemo(() => resultRows.slice(pagination.offset, pagination.to), [resultRows, pagination.offset, pagination.to]);
  const resultRowKey = useCallback((row: ResultRow, i: number) => ratesResultRowKey(row, pagination.offset + i), [pagination.offset]);
  const catalogueOptions = useMemo(() => ({ ...EMPTY_SEARCH_FILTER_OPTIONS,
    providers: [...new Set(unlistedEntries.map(item => item.provider).filter((value): value is string => Boolean(value)))].sort() }), [unlistedEntries]);
  const activeFilterOptions = draftAvailability === 'unlisted' ? catalogueOptions : filterOptions.options;

  const draftResultCount = useCallback(
    async (draft: Filters, cancelled?: () => boolean) => (
      // Suitability rebuilds can keep the same row array; count against the gate the list uses.
      void suitabilityRevision,
      (await filterRowsCooperatively(
        mortgageScope.rows,
        { ...draft, query: debouncedQuery },
        details?.products ?? null,
        resultSearchIndex,
        section,
        { cancelled },
      ))?.length ?? null
    ),
    [mortgageScope.rows, debouncedQuery, details?.products, resultSearchIndex, section, suitabilityRevision],
  );
  const unlistedResultCount = useCallback((draft: Filters, cancelled?: () => boolean) => {
    void suitabilityRevision;
    const term = debouncedQuery.trim().toLocaleLowerCase();
    return countItemsCooperatively(unlistedEntries, item =>
      (!draft.providers.length || draft.providers.includes(item.provider ?? '')) &&
      (!term || [item.key, item.name, item.provider, item.productCategory, item.description]
        .filter(Boolean).join(' ').toLocaleLowerCase().includes(term)), { cancelled });
  }, [unlistedEntries, debouncedQuery, suitabilityRevision]);

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
    // Keep Mortgage LVR + purpose + repayment so clearing temporary filters /
    // audit search.filters.clear does not collapse the list behind the criteria
    // gate. Reset Rates view clears those explicitly below.
    const mortgage = section === 'Mortgage' ? useRatesSession.getState().sections.Mortgage.filters : null;
    updateRatesSection(section, { query: '', path: [], hierarchyScoped: false, intentError: null,
      filters: { ...EMPTY_FILTERS, includeNonStandard,
        ...(mortgage ? { loanPurposes: mortgage.loanPurposes, repaymentTypes: mortgage.repaymentTypes } : {}) },
      includeNonStandardOverride: null }, true);
  }, [includeNonStandard, section]);
  const resetRatesView = useCallback(() => {
    if (section === 'Mortgage') clearMortgageComparison();
    updateRatesSection(section, { query: '', path: [], hierarchyScoped: false, intentError: null,
      filters: { ...EMPTY_FILTERS, includeNonStandard }, includeNonStandardOverride: null }, true);
  }, [includeNonStandard, section]);
  const intentPending = Boolean(intentKey && consumedIntent.current !== intentKey) || !session.initialized;
  const searchPending = intentPending || (availability === 'unlisted' ? !catalogueDetails
    : section === 'Mortgage' && !mortgageCriteriaReady ? false
    : detailFiltersPending || searchIndexLoading || !publicPricing.ready || !preparedResults.ready);
  const presented = useRef<{ rows: typeof pageRows; section: SectionKey; availability: RateAvailability;
    core: typeof core; catalogue: typeof catalogue; revision: number; scenarioFor: typeof rowScenario;
    unverified: WeakSet<RateRow> } | null>(null);
  useLayoutEffect(() => {
    if (!searchPending && !task.intentError && !publicPricing.error && !preparedResults.error) {
      presented.current = { rows: pageRows, section, availability, core, catalogue, revision: suitabilityRevision,
        scenarioFor: rowScenario, unverified: mortgageScope.unverifiedRows };
    }
  }, [searchPending, task.intentError, publicPricing.error, preparedResults.error, pageRows, section, availability,
    core, catalogue, suitabilityRevision, rowScenario, mortgageScope.unverifiedRows]);
  const previous = presented.current;
  const retainingPrevious = section === 'Mortgage' && searchPending && mortgageCriteriaReady && previous != null && previous.rows.length > 0 &&
    previous.section === section && previous.availability === availability && previous.core === core &&
    previous.catalogue === catalogue && previous.revision === suitabilityRevision;
  const displayedPageRows = retainingPrevious ? previous.rows : pageRows;
  const displayedScenario = retainingPrevious ? previous.scenarioFor : rowScenario;
  const displayedUnverified = retainingPrevious ? previous.unverified : mortgageScope.unverifiedRows;
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
  const [emptyCommit, setEmptyCommit] = useState<string | null>(null);
  const listReadiness = useVirtualizedListReadiness(listRevision, pageRows.length);
  const measuredVisibility = useRef(listReadiness.measuredVisibleCount);
  measuredVisibility.current = listReadiness.measuredVisibleCount;
  const { onCommitLayoutEffect: markListCommit, onLoad: markListLoad, onViewableItemsChanged: markListViewability } = listReadiness;
  const listRef = useRef<FlashListRef<ResultRow>>(null);
  const listLoaded = useRef(false);
  const [restoredDataRevision, setRestoredDataRevision] = useState<string | null>(null);
  type ViewabilityToken = { isViewable?: boolean | null; item: ResultRow; index?: number | null; key?: string };
  type ViewabilityInfo = { viewableItems: ViewabilityToken[]; changed?: ViewabilityToken[] };
  const auditViewability = useRef<(info: ViewabilityInfo) => void>(() => {});
  const restorationKey = JSON.stringify([listDataRevision, getRatesSessionRestoreRevision()]);
  const [sheetEvidence, setSheetEvidence] = useState<Record<'filter' | 'sort' | 'tools', SheetAuditState>>({ filter: 'hidden', sort: 'hidden', tools: 'hidden' });
  const filterEvidence = useCallback((state: SheetAuditState) => setSheetEvidence(previous => previous.filter === state ? previous : { ...previous, filter: state }), []);
  const sortEvidence = useCallback((state: SheetAuditState) => setSheetEvidence(previous => previous.sort === state ? previous : { ...previous, sort: state }), []);
  const toolsEvidence = useCallback((state: SheetAuditState) => setSheetEvidence(previous => previous.tools === state ? previous : { ...previous, tools: state }), []);
  const sheetCovered = filterOpen || sortOpen || toolsOpen || Object.values(sheetEvidence).some(state => state !== 'hidden');
  const sheetsReady = (filterOpen ? sheetEvidence.filter === 'presented' : sheetEvidence.filter === 'hidden') &&
    (sortOpen ? sheetEvidence.sort === 'presented' : sheetEvidence.sort === 'hidden') &&
    (toolsOpen ? sheetEvidence.tools === 'presented' : sheetEvidence.tools === 'hidden');
  const physicalVisibility = usePhysicalListVisibility(listRevision, pageRows,
    isFocused && restoredDataRevision === restorationKey && !sheetCovered, resultRowKey,
    info => auditViewability.current(info));
  const requestPhysicalVisibility = useRef(physicalVisibility.measure);
  requestPhysicalVisibility.current = physicalVisibility.measure;
  const physicalCapture = useRef(physicalVisibility.active);
  physicalCapture.current = physicalVisibility.active;
  const viewabilityEvents = useRef(0);
  const currentRows = useRef(pageRows);
  currentRows.current = pageRows;
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
  // Rates preserves its native list across query/disclosure revisions. Keep
  // FlashList's callback stable; validate row identity before forwarding to the
  // current revision-bound readiness callback.
  const currentListRevision = useRef(listRevision);
  currentListRevision.current = listRevision;
  const currentListViewability = useRef(markListViewability);
  currentListViewability.current = markListViewability;
  const onViewableItemsChanged = useCallback((info: ViewabilityInfo) => {
    if (!restoration.current.applied || info.viewableItems.some(token => token.isViewable === true && !currentRows.current.includes(token.item))) return;
    let measured = info;
    if (!info.viewableItems.some(token => token.isViewable === true)) {
      // Empty events carry no positive row identity. A delayed event from an
      // older scope must not be stamped as the current viewport. FlashList's
      // changed tokens reject old rows; current geometry establishes visibility.
      if (info.changed?.some(token => !currentRows.current.includes(token.item))) return;
      // Membership can survive disclosure and overlapping query revisions.
      // Even changed tokens therefore need current physical viewport evidence.
      const viewport = measuredRatesViewport(listRef.current, currentRows.current, currentListRevision.current);
      if (!viewport) return;
      measured = viewport;
    }
    viewabilityEvents.current++;
    currentListViewability.current(measured);
    if (physicalCapture.current) requestPhysicalVisibility.current();
    else auditViewability.current(measured);
  }, []);
  useEffect(() => {
    // In-place selection/disclosure changes do not change visible indices, so
    // FlashList may omit its usual viewability callback. Request a fresh native
    // measurement after this render commits; layout alone is not visible proof.
    if (!isFocused || !listReadiness.ready || restoredDataRevision !== restorationKey) return;
    let frame: number | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let attempts = 0;
    const measure = () => { frame = requestAnimationFrame(() => {
      if (stopped) return;
      const before = viewabilityEvents.current;
      listRef.current?.recomputeViewableItems();
      // A native callback (including an explicitly empty viewport) wins.
      if (viewabilityEvents.current !== before || measuredVisibility.current !== null) return;
      const measured = measuredRatesViewport(listRef.current, currentRows.current, listRevision);
      if (measured) onViewableItemsChanged(measured);
      // Layout can lag a committed list. Retry briefly; never invent evidence
      // or keep polling a hidden, replaced or unmounted list.
      else if (++attempts < 30) retry = setTimeout(measure, 40);
    }); };
    measure();
    return () => {
      stopped = true;
      if (frame !== undefined) cancelAnimationFrame(frame);
      if (retry !== undefined) clearTimeout(retry);
    };
  }, [isFocused, listRevision, listReadiness.ready, restoredDataRevision, restorationKey, onViewableItemsChanged]);
  useEffect(() => {
    if (isFocused && !intentPending && !searchPending && listReadiness.visiblyCommitted) {
      checkDrillOutcome(section, path);
    }
  });
  const logoReadiness = useLogoReadiness(listDataRevision);
  const auditTarget = useRatesAuditTarget({ physicalViewport: physicalVisibility.active, rows: pageRows, results: resultRows, page: pagination.page, size: pageSize,
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
  const applyMortgageScope = useCallback((args: readonly unknown[]) => {
    if (section !== 'Mortgage') return { unavailableReason: 'Mortgage comparison scope requires the Mortgage section' };
    if (availability === 'unlisted') return { unavailableReason: 'Mortgage comparison scope requires listed rates' };
    useMortgageComparison.setState({
      loanAmount: auditActionString(args, 'loanAmount') ?? '',
      lvr: auditActionString(args, 'lvr') ?? '',
    });
    updateRatesSection('Mortgage', current => ({
      page: 1,
      filters: {
        ...current.filters,
        loanPurposes: auditActionStrings(args, 'loanPurposes'),
        repaymentTypes: auditActionStrings(args, 'repaymentTypes'),
      },
    }), true);
  }, [availability, section]);
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
    'search.mortgage.scope.apply.0': (...args: unknown[]) => applyMortgageScope(args),
    'search.mortgage.scope.apply.1': (...args: unknown[]) => applyMortgageScope(args),
    'search.mortgage.scope.clear': () => {
      if (section !== 'Mortgage') return { unavailableReason: 'Mortgage comparison scope requires the Mortgage section' };
      clearMortgageComparison();
      updateRatesSection('Mortgage', current => ({
        page: 1,
        filters: { ...current.filters, loanPurposes: [], repaymentTypes: [] },
      }), true);
    },
    'search.compare.mode': toggleCompareMode,
    'search.compare.page.0': prepareAuditComparePage,
    'search.compare.select.0': selectAuditToken,
    'search.compare.page.1': prepareAuditComparePage,
    'search.compare.select.1': selectAuditToken,
    'search.compare.open': (...args: unknown[]) => {
      const exactTokens = auditActionStrings(args, 'selectionTokens');
      const tokens = exactTokens.length >= 2 ? exactTokens : selected;
      if (tokens.length >= 2) openCompare(tokens, 'rates-comparison');
    },
  }), [applyFilters, applyMortgageScope, availability, cancelFilters, changeSection, clearSearchFilters, draftFilters, filterOpen, openFilters, prepareAuditComparePage, section, selected, selectAuditToken, setQuery, setSortKey, setSortOpen, sortOptions, toggleCompareMode]);
  // Logo decode callbacks can churn during mortgage.scope.apply settle; the
  // logos probe is optional, so wait until search.data/list are no longer pending.
  const logoCallbacksActive = physicalVisibility.active && !searchPending && listReadiness.visiblyCommitted;
  const { refFor: physicalCellRef, measure: measurePhysicalCells } = physicalVisibility;
  const renderProduct = useCallback(({ item, target }: { item: ResultRow; target?: string }) => <View collapsable={false}
    ref={target === 'Cell' ? physicalCellRef(item) : undefined}
    onLayout={measurePhysicalCells}>{'product_key' in item ? (
    <SearchProductRow row={item} section={section}
      onLogoRenderStateChange={logoCallbacksActive ? logoReadiness.onLogoRenderStateChange : undefined}
      quoteOwner={indexedPricing && !searchPending && !retainingPrevious ? mortgageIndex.index : null}
      rateScenario={displayedScenario(item)} comparisonUnverified={section === 'Mortgage' && displayedUnverified.has(item)}
      auditCell={target === 'Cell' && !retainingPrevious} auditRevision={listRevision} onAuditCellCommit={auditTarget.onCellCommit}
      selectMode={selectMode} selectionToken={selectionTokenFor(item)} selected={selected.includes(selectionTokenFor(item))} onToggleSelect={toggleSelect} />
  ) : <TouchTarget fill onPress={() => openProduct(item.key)} accessibilityRole="button"
      accessibilityLabel={uiProductName({product_name:item.name??''})} style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
      <AppText variant="body" weight="600">{uiProductName({product_name:item.name??''})}</AppText>
      <AppText variant="small" color="textMuted">{uiJoin(uiProviderName({provider:item.provider??''}),' · ',humanizeEnum(item.productCategory??''))}</AppText>
      <AppText variant="small" color="textMuted">{uiLabel("No listed rate")}</AppText>
    </TouchTarget>}</View>, [physicalCellRef, measurePhysicalCells, auditTarget.onCellCommit, listRevision, logoCallbacksActive, section, logoReadiness.onLogoRenderStateChange, selectMode, selected, selectionTokenFor, toggleSelect, theme.colors.border, displayedUnverified, displayedScenario, retainingPrevious, indexedPricing, searchPending, mortgageIndex.index]);
  usePerformanceAuditSurface({
    id: 'rates.results',
    work: { ...publicPricing.work, mortgageCriteriaReady, mortgageInputsInvalid, preparingMortgageDefaults,
      mortgageIndexStatus: mortgageIndex.status, mortgageIndexReady: mortgageIndex.index != null,
      mortgageIndexRows: mortgageIndex.index?.count ?? 0,
      suitabilityReady: isSuitabilityFilterReady(effectiveFilters.includeNonStandard), detailsLoading, searchIndexLoading,
      intentPending, filterReady: preparedResults.ready, filterRowsReused: preparedResults.reused, focused: isFocused },
    routeKey: '/browse',
    datasetRevision: coreSha ?? core?.run_date ?? null,
    renderRevision: surfaceRevision,
    actions: auditActions,
    probes: [
      auditTarget.targetProbe,
      { id: 'search.sheet', kind: 'layout', status: sheetsReady ? 'ready' : 'pending', layoutMeasured: sheetsReady },
      {
        id: 'search.data',
        kind: 'data',
        // datasetRevision tracks settled prep, not merely payload identity —
        // otherwise diagnostics show datasetMatches=true while status=pending.
        status: task.intentError || preparedResults.error || publicPricing.error ? 'error' : !searchPending && core ? 'ready' : 'pending',
        error: task.intentError ?? preparedResults.error ?? publicPricing.error,
        datasetRevision: !searchPending && core ? (coreSha ?? core.run_date ?? null) : null,
      },
      {
        id: 'search.list',
        kind: 'list',
        coveredBySheet: sheetCovered,
        // Settled 0 listed (criteria complete, pricing done) is ready empty —
        // FlashList often skips viewability for ListEmptyComponent and must
        // not leave search.list pending forever after mortgage.scope.apply.
        // A non-empty page stays pending until a real viewport count. Layout
        // seeding alone is not that count: a hidden or pre-restore list can
        // already be committed.
        status: (() => {
          const settledEmpty = pageRows.length === 0 && !searchPending && emptyCommit === listRevision;
          if (settledEmpty) return 'ready';
          return searchPending || (physicalVisibility.active
            ? (physicalVisibility.visibleCount ?? 0) === 0
            : !listReadiness.visiblyCommitted || (listReadiness.measuredVisibleCount ?? 0) === 0) ? 'pending' : 'ready';
        })(),
        expectedCount: pageRows.length,
        actualCount: pageRows.length === 0 && !searchPending ? 0 : listReadiness.committedItemCount,
        visibleCount: pageRows.length === 0 && !searchPending ? 0 : physicalVisibility.active ? physicalVisibility.visibleCount : listReadiness.measuredVisibleCount,
        emptyStateRendered: pageRows.length === 0 && !searchPending && emptyCommit === listRevision,
      },
      {
        id: 'search.layout',
        kind: 'layout',
        status: pageRows.length === 0 && !searchPending ? 'ready' : listReadiness.ready ? 'ready' : 'pending',
        layoutMeasured: pageRows.length === 0 && !searchPending ? true : listReadiness.ready,
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
              <AppText variant="tiny" color="textMuted">{uiJoin(searchPending ? uiJoin('Updating', retainingPrevious ? ' · ' : null, retainingPrevious ? 'Previous results' : null):uiJoin(uiCount(resultRows.length),' ',availability === 'listed' ? 'rates' : 'products'),searchSub?uiJoin(' · ','Alert on'):null)}</AppText>
              <AppText variant="tiny" color="textMuted" accessibilityLabel={sortLabel}>{compactSortLabel}</AppText>
            </View>
            {path.length ? <Button title="Clear scope" variant="ghost" onPress={() => updateRatesSection(section, { path: [], hierarchyScoped: false }, true)} /> : null}
            {searchIndexUnavailable ? <Row><AppText variant="tiny" color="textMuted">{uiLabel("Name search")}</AppText>
              {searchIndexStatus === 'error' ? <Button title="Retry search" variant="ghost" onPress={() => void ensureSearchIndex()} /> : null}</Row> : null}
        </View>
        {/* Keep the recycler's native measurement origin at zero beneath the
            fixed controls; a sibling offset otherwise corrupts its visible range. */}
        <View ref={physicalVisibility.viewport} collapsable={false} style={{ flex: 1 }} onLayout={physicalVisibility.measure}>
        <FlashList
          ref={attachList}
          drawDistance={FLASH_LIST_DRAW_DISTANCE}
          // Keep the list mounted while the fixed task controls change results.
          // Session state owns offsets; automatic item anchoring would compete.
          maintainVisibleContentPosition={{ disabled: true }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          data={displayedPageRows}
          ListHeaderComponent={availability === 'listed' ? <View style={{ gap: 8 }}>
            <SavedRequirementsSummary section={section} catalogueRows={summaryCatalogueRows} />
            {section === 'Mortgage' ? <MortgageComparisonControls catalogue={catalogue} rows={core.sections.Mortgage.rates} filters={filters}
              unverified={mortgageCriteriaReady ? unverifiedResultCount : 0} invalid={mortgageScope.invalid} /> : null}
            {mortgageSearchActive && catalogue.status !== 'unavailable' ? <><PublicPricingCoverage section={section} rows={pricingCandidates} scenario={scenario} scenarioForRow={rowScenario} compact
              pricingSummary={publicPricing.ready ? {
                priced: baseRows.length,
                unresolved: Math.max(0, pricingCandidates.length - baseRows.length),
                complete: publicPricing.resolution.complete,
              } : null} />
              {/* Mount after pricing so catalogue re-expansion cannot stall search.data. */}
              {publicPricing.ready ? <PublicProductDiscovery eligibleProductKeys={discoveryKeys} section={section} rateScenario={scenarioFor(section)} pricingOrigin="rates-comparison" rows={baseRows} query={debouncedQuery} /> : null}</> : null}
          </View> : null}
          ListFooterComponent={<RatesPagination total={resultRows.length} page={pagination.page} size={pageSize}
            noun={availability === 'listed' ? 'rates' : 'products'} pending={searchPending}
            onPage={page => updateRatesSection(section, { page }, true)}
            onSize={size => useStore.getState().setPref('ratesPageSize', size)} />}
          onCommitLayoutEffect={onListCommit}
          onLoad={onListLoad}
          onContentSizeChange={listReadiness.onContentSizeChange}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={FLASH_LIST_VIEWABILITY_CONFIG}
          extraData={listRevision}
          keyExtractor={resultRowKey}
          getItemType={item => 'product_key' in item ? 'rate' : 'unlisted'}
          onScroll={event => {
            physicalVisibility.measure();
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
          ListEmptyComponent={<View key={`empty:${listRevision}:${searchPending}`} onLayout={event => {
            const { width: emptyWidth, height: emptyHeight } = event.nativeEvent.layout;
            if (!searchPending && pageRows.length === 0 && Number.isFinite(emptyWidth) && Number.isFinite(emptyHeight) && emptyWidth > 0 && emptyHeight > 0) {
              setEmptyCommit(previous => currentListRevision.current === listRevision ? listRevision : previous);
            }
          }}>{
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
            ) : preparedResults.error || publicPricing.error ? (
              <View style={{ gap: theme.spacing(3), paddingTop: theme.spacing(4) }}>
                <EmptyState title="Products unavailable"  />
                <Button title="Retry" variant="secondary" onPress={publicPricing.error ? publicPricing.retry : preparedResults.retry} />
              </View>
            ) : section === 'Mortgage' && availability === 'listed' && !mortgageCriteriaReady ? (
              <View style={{ gap: theme.spacing(3), paddingTop: theme.spacing(4) }}>
                <EmptyState title={mortgageInputsInvalid ? 'Invalid comparison inputs' : 'Inputs incomplete'} />
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
                  onPress={resetRatesView}
                />
                <Button title="Edit saved requirements" variant="ghost" onPress={() => router.push('/profile')} />
              </View>
            )
          }</View>}
        />
        </View>
      </View>

      {selectMode && selected.length >= 2 ? (
        <CompareDock
          count={selected.length}
          onPress={() => openCompare(selected, 'rates-comparison')}
        />
      ) : null}

      <FilterSheet
        onAuditStateChange={physicalVisibility.active ? filterEvidence : undefined}
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
        preserveOnReset={section === 'Mortgage' ? {
          loanPurposes: effectiveFilters.loanPurposes,
          repaymentTypes: effectiveFilters.repaymentTypes,
        } : undefined}
        resultNoun={draftAvailability === 'listed' ? 'rates' : 'products'}
        resultCount={draftAvailability === 'listed' ? draftResultCount : unlistedResultCount}
      >
        {draftAvailability === 'listed' ? <SavedRequirementsSummary section={section} catalogueRows={summaryCatalogueRows}
          onEdit={() => { setFilterOpen(false); router.push('/profile'); }} /> : null}
        <View style={{ gap: 8 }}><AppText variant="small" weight="700">{uiLabel("Availability")}</AppText>
          <SegmentedControl value={draftAvailability} options={[{ value: 'listed', label: uiLabel("Listed rate") }, { value: 'unlisted', label: uiLabel("No listed rate") }]} onChange={setDraftAvailability} />
        </View>
      </FilterSheet>
      <SheetSurface onAuditStateChange={physicalVisibility.active ? sortEvidence : undefined} visible={sortOpen} title="Sort" onClose={() => setSortOpen(false)}>
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
      <SheetSurface onAuditStateChange={physicalVisibility.active ? toolsEvidence : undefined} visible={toolsOpen} title="Search" onClose={() => setToolsOpen(false)}>
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

