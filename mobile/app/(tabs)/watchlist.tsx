import { usePublicRateCatalogue } from '../../src/data/publicRateCatalogue';
import { publicOfferSelectionToken } from '../../src/data/publicOfferIdentity';
import { publicComparisonCore, publicRateScenario, publicRecommendationRows, resolveLocalCurrentRate, resolvedPublicRankingRows } from '../../src/data/publicRateIntegration';
import { uiCount, uiDate, uiJoin, uiLabel, uiNumber, uiSectionName, type UiCopy } from "../../src/lib/uiCopy";
import { mandatoryEligibleRows } from '../../src/data/eligibilityGate';
import { useScrollToTop } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { EmptyState, ScreenSkeleton } from '../../src/components/feedback';
import { ProductCard } from '../../src/components/ProductCard';
import { Screen, ScreenScrollView } from '../../src/components/Screen';
import { UndoSnackbar } from '../../src/components/Snackbar';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { AppText, Button, Card, Disclosure, Row, SectionHeading } from '../../src/components/ui';
import { SECTION_ORDER, SECTIONS } from '../../src/constants';
import { computeLvr } from '../../src/data/calc';
import { toggleCompareSelection, resolveCompareSelections } from '../../src/data/compareSelection';
import { formatRate, toFraction } from '../../src/data/format';
import {
  profileFeaturesForSection,
  scenarioProfileFilterRows,
} from '../../src/data/profile';
import {
  makeSavedRateRef,
  resolveSavedRates,
  unresolvedSavedRateRefs,
  type SavedRateRef,
} from '../../src/data/savedRates';
import { bestRow } from '../../src/data/selectors';
import { useStore } from '../../src/data/store';
import { isSuitabilityFilterReady } from '../../src/data/suitabilityGate';
import {
  normalizeTrackedRates,
  queueTrackedRatesSecureSave,
  type TrackedRate,
} from '../../src/data/trackedRates';
import { useLogoReadiness } from '../../src/hooks/useLogoReadiness';
import { usePerformanceAuditSurface } from '../../src/hooks/usePerformanceAuditReadiness';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import { useUndoSnackbar } from '../../src/hooks/useUndoSnackbar';
import { useUserRateScenario } from '../../src/hooks/useUserRateScenario';
import { openCompare, openProduct } from '../../src/lib/nav';
import {
  auditActionString,
  auditActionStrings,
} from '../../src/lib/performanceAuditActionParams';
import { useTheme } from '../../src/theme/ThemeProvider';
import type { RateRow, SectionKey } from '../../src/types';
import { savedEmptyState } from '../../src/lib/savedEmptyState';

function compareToken(productKey: string, rateIndex: number | null, offerId?: string): string {
  return offerId ? publicOfferSelectionToken(productKey, offerId) : rateIndex == null ? productKey : `${rateIndex}#${productKey}`;
}

interface RatePosition {
  section: SectionKey;
  currentRate: number;
  matchedRate: number | null;
  gapRate: number | null;
  ready: boolean;
}

function positionHeadline(position: RatePosition): UiCopy {
  if (!position.ready) return 'Matching';
  if (position.matchedRate == null || position.gapRate == null) {
    return 'Matched rate unavailable';
  }
  if (position.gapRate <= 0) return 'No better matched rate';
  return uiJoin('Gap',': ',uiNumber(position.gapRate*100,2),' ','percentage points');
}

let auditSavedFixtureSnapshot: {
  savedRates: SavedRateRef[];
  trackedRates: TrackedRate[];
  favorites: string[];
} | null = null;

export default function MyRates() {
  const theme = useTheme();
  const [positionsOpen, setPositionsOpen] = useState(false);
  const core = useStore((s) => s.core);
  const manifest = useStore((s) => s.manifest);
  const publicCatalogue = usePublicRateCatalogue(manifest);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? '');
  const storeStatus = useStore((s) => s.status);
  const storeError = useStore((s) => s.error);
  const savedRates = useStore((s) => s.savedRates);
  const trackedRates = useStore((s) => s.trackedRates);
  const removeSavedRate = useStore((s) => s.removeSavedRate);
  const restoreSavedRate = useStore((s) => s.restoreSavedRate);
  const subscriptions = useStore((s) => s.subscriptions);
  const setActiveSection = useStore((s) => s.setActiveSection);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const detailsLoading = useStore((s) => s.detailsLoading);
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const profileFilters = useStore((s) => s.prefs.profileFilters);
  const { scenario, storageStatus: scenarioStatus } = useUserRateScenario();
  const suitabilityRevision = useSuitabilityRevision();
  const { snack, showUndo, undo } = useUndoSnackbar();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [layoutReady, setLayoutReady] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const items = useMemo(() => {
    void suitabilityRevision;
    return core ? resolveSavedRates(core, savedRates, publicCatalogue, section => publicRateScenario(section, scenario, profileFilters)).filter(item => mandatoryEligibleRows([item.row]).length > 0) : [];
  }, [core, savedRates, suitabilityRevision, publicCatalogue, scenario, profileFilters]);
  const unavailableRefs = useMemo(
    () => unresolvedSavedRateRefs(savedRates, items),
    [items, savedRates],
  );
  const trackedById = useMemo(
    () => new Map(trackedRates.map((tracked) => [tracked.id, tracked])),
    [trackedRates],
  );

  const profileDetailsPending = SECTION_ORDER.some(
    (section) => profileFeaturesForSection(profileFilters, section).length > 0 && !detailsProducts,
  );
  useEffect(() => {
    if (profileDetailsPending) void ensureDetails();
  }, [ensureDetails, profileDetailsPending]);

  const positions = useMemo<RatePosition[]>(() => {
    void suitabilityRevision;
    if (!core || scenarioStatus !== 'ready') return [];
    const mortgage = computeLvr(scenario.mortgage);
    return SECTION_ORDER.flatMap((section): RatePosition[] => {
      const local = resolveLocalCurrentRate(section, scenario, publicCatalogue.references, undefined, publicCatalogue, profileFilters);
      const currentRate = local.status === 'exact' && local.payableRate != null ? Number(local.payableRate) : null;
      if (currentRate == null) return [];
      const rows = core.sections[section]?.rates ?? [];
      const ready = isSuitabilityFilterReady(includeNonStandard)
        && !(profileFeaturesForSection(profileFilters, section).length > 0 && !detailsProducts)
        && (publicCatalogue.status === 'unavailable' || publicCatalogue.status === 'ready' && publicCatalogue.allLoaded);
      if (!ready) {
        return [{
          section,
          currentRate,
          matchedRate: null,
          gapRate: null,
          ready: false,
        }];
      }
      const candidates = publicRecommendationRows(rows, publicCatalogue, section, publicRateScenario(section, scenario, profileFilters));
      const pricing = resolvedPublicRankingRows(scenarioProfileFilterRows(candidates, profileFilters, section, mortgage.lvr, detailsProducts), publicCatalogue,
        row => publicRateScenario(section, scenario, profileFilters, row));
      const match = bestRow(
        pricing.rows,
        section,
        includeNonStandard,
        depositRankMetric,
        detailsProducts,
        mortgageRateMetric,
      );
      // A comparison-rate ranking may select the mortgage product, but its
      // observed interest rate is the like-for-like input for dollar impact.
      const matchedRate = match ? toFraction(match.rate) : null;
      const gapRate = matchedRate == null
        ? null
        : Math.max(0, section === 'Mortgage' ? currentRate - matchedRate : matchedRate - currentRate);
      return [{
        section,
        currentRate,
        matchedRate,
        gapRate,
        ready: true,
      }];
    });
  }, [
    core,
    depositRankMetric,
    detailsProducts,
    includeNonStandard,
    mortgageRateMetric,
    profileFilters,
    scenario,
    scenarioStatus,
    suitabilityRevision,
    publicCatalogue,
  ]);

  const openRateEditor = useCallback((section: SectionKey) => {
    setActiveSection(section);
    router.push({ pathname: '/calculator', params: { intent: 'check', section } });
  }, [setActiveSection]);

  const toggleCompareMode = useCallback(() => {
    setSelectMode((value) => !value);
    setSelected([]);
  }, []);
  const toggleSelection = useCallback((token: string) => {
    if (!core) return;
    const update = toggleCompareSelection(publicComparisonCore(core, publicCatalogue,
      section => publicRateScenario(section, scenario, profileFilters)), selected, token);
    if (update.rejection === 'limit_reached') {
      Alert.alert('Maximum 4 rates');
      return;
    }
    if (update.rejection === 'category_mismatch') {
      Alert.alert('Mixed rate categories');
      return;
    }
    if (update.rejection === 'unavailable') {
      Alert.alert('Rate unavailable');
      return;
    }
    setSelected(update.tokens);
  }, [core, selected, publicCatalogue, scenario, profileFilters]);
  const findExactRow = useCallback((token: string): RateRow | null => {
    if (!core) return null;
    const effectiveCore = publicComparisonCore(core, publicCatalogue,
      section => publicRateScenario(section, scenario, profileFilters));
    return resolveCompareSelections(effectiveCore, [token])[0]?.row ?? null;
  }, [core, publicCatalogue, scenario, profileFilters]);
  const ensureExactPair = useCallback((...args: unknown[]) => {
    const tokens = auditActionStrings(args, 'selectionTokens');
    auditSavedFixtureSnapshot ??= {
      savedRates: JSON.parse(JSON.stringify(useStore.getState().savedRates)) as SavedRateRef[],
      trackedRates: JSON.parse(JSON.stringify(useStore.getState().trackedRates)) as TrackedRate[],
      favorites: [...useStore.getState().favorites],
    };
    const rows = mandatoryEligibleRows(tokens.map(findExactRow).filter((row): row is RateRow => row != null));
    if (rows.length < 2 || rows.length !== tokens.length) {
      return { unavailableReason: 'The selected exact comparison pair is absent from the eligible current catalogue' };
    }
    useStore.setState((state) => {
      const fixtureKeys = new Set(rows.map((row) => row.product_key));
      const retained = state.savedRates.filter((ref) => !fixtureKeys.has(ref.productKey));
      const additions = rows.map((row) => makeSavedRateRef(
        row,
        row.public_offer_id || Number.isInteger(row.rate_index) ? 'rate' : 'product',
      ));
      const next = [...retained, ...additions];
      return {
        savedRates: next,
        trackedRates: normalizeTrackedRates(state.trackedRates, next),
        favorites: [...new Set(next.map((ref) => ref.productKey))],
      };
    });
    return queueTrackedRatesSecureSave(useStore.getState().trackedRates).then(() => ({
      fixtureReady: true,
      selectionTokens: tokens,
    }));
  }, [findExactRow]);
  const restoreSavedFixture = useCallback(() => {
    const snapshot = auditSavedFixtureSnapshot;
    if (!snapshot) return;
    useStore.setState({
      savedRates: JSON.parse(JSON.stringify(snapshot.savedRates)) as SavedRateRef[],
      trackedRates: JSON.parse(JSON.stringify(snapshot.trackedRates)) as TrackedRate[],
      favorites: [...snapshot.favorites],
    });
    auditSavedFixtureSnapshot = null;
    setSelectMode(false);
    setSelected([]);
    return queueTrackedRatesSecureSave(useStore.getState().trackedRates);
  }, []);
  const selectAuditToken = useCallback((...args: unknown[]) => {
    const token = auditActionString(args, 'selectionToken');
    if (token) toggleSelection(token);
  }, [toggleSelection]);
  const openSelectedCompare = useCallback(() => {
    if (selected.length < 2) return undefined;
    openCompare(selected);
    return { expectedPath: '/compare' };
  }, [selected]);
  const coreRevision = core ? `${core.run_date}:${coreSha}` : null;
  const savedRenderRevision = `${coreRevision ?? 'none'}:${positions.length}:${items.length}:${unavailableRefs.length}:${subscriptions.length}:${selectMode ? 'select' : 'view'}:${selected.join(',')}`;
  const savedLogoIds = useMemo(
    () => selectMode ? [] : items.map(({ ref }) => `saved:${ref.id}`),
    [items, selectMode],
  );
  const savedLogos = useLogoReadiness(savedRenderRevision, savedLogoIds);
  const openSavedProduct = useCallback((row: RateRow) => {
    if (row.public_programme_id) openProduct(row.product_key, row.rate_index, row.public_programme_id);
    else openProduct(row.product_key, row.rate_index);
    return { expectedPath: `/product/${encodeURIComponent(row.product_key)}` };
  }, []);
  const openSavedProductForAudit = useCallback((...args: unknown[]) => {
    if (selectMode) return { unavailableReason: 'Saved product is unavailable during comparison selection' };
    const id = auditActionString(args, 'savedId');
    const item = id ? items.find(value => value.ref.id === id) : items[0];
    if (!item) return { unavailableReason: 'Selected saved rate is unavailable' };
    return openSavedProduct(item.row);
  }, [items, openSavedProduct, selectMode]);
  const auditActions = useMemo(() => ({
    'saved.open': () => undefined,
    'saved.product.open': openSavedProductForAudit,
    'saved.fixture.ensure-exact-pair': ensureExactPair,
    'saved.compare.mode': toggleCompareMode,
    'saved.compare.select.0': selectAuditToken,
    'saved.compare.select.1': selectAuditToken,
    'saved.compare.open': openSelectedCompare,
    'saved.fixture.restore': restoreSavedFixture,
  }), [openSavedProductForAudit, ensureExactPair, openSelectedCompare, restoreSavedFixture, selectAuditToken, toggleCompareMode]);
  usePerformanceAuditSurface({
    id: 'saved.list',
    routeKey: '/watchlist',
    datasetRevision: coreRevision,
    renderRevision: savedRenderRevision,
    actions: auditActions,
    probes: [
      {
        id: 'saved.data',
        kind: 'data',
        status: core ? 'ready' : storeStatus === 'error' ? 'error' : 'pending',
        error: !core && storeStatus === 'error' ? storeError ?? 'Core data unavailable' : null,
        datasetRevision: coreRevision,
      },
      {
        id: 'saved.items',
        kind: 'list',
        status: core ? 'ready' : 'pending',
        expectedCount: items.length,
        actualCount: items.length,
      },
      {
        id: 'saved.logos',
        kind: 'logo',
        status: savedLogos.ready ? 'ready' : 'pending',
        expectedCount: savedLogos.expectedCount,
        actualCount: savedLogos.terminalCount,
        fallbackCount: savedLogos.fallbackCount,
      },
      {
        id: 'saved.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
        renderRevision: savedRenderRevision,
      },
    ],
  });

  const remove = useCallback((id: string) => {
    const item = items.find((candidate) => candidate.ref.id === id);
    const tracked = trackedById.get(id);
    if (!item) return;
    removeSavedRate(id);
    setSelected((prev) => prev.filter((token) =>
      token !== compareToken(item.row.product_key, item.row.rate_index ?? null, item.row.public_offer_id)));
    showUndo('Removed', () => {
      restoreSavedRate(item.ref, tracked);
    });
  }, [items, removeSavedRate, restoreSavedRate, showUndo, trackedById]);

  if (!core) return <ScreenSkeleton />;

  const hasAnyPrivateRate = positions.length > 0;
  if (!items.length && !hasAnyPrivateRate && scenarioStatus === 'ready') {
    const emptyState = savedEmptyState({ savedCount: savedRates.length, unavailableCount: unavailableRefs.length });
    return (
      <Screen onLayout={() => setLayoutReady(true)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>
          <EmptyState icon="star-outline" title={uiLabel(emptyState === 'unavailable'
            ? 'Saved rate unavailable' : emptyState === 'hiddenByProfile' ? 'Hidden by profile' : 'No saved rates')} />
          {emptyState === 'unavailable' ? (
            <Button
              title="Remove unavailable save"
              variant="secondary"
              onPress={() => unavailableRefs.forEach((ref) => removeSavedRate(ref.id))}
            />
          ) : null}
          {emptyState === 'hiddenByProfile' ? (
            <Button title="Edit profile" variant="secondary" onPress={() => router.push('/profile')} />
          ) : null}
          <Button title="Rate check" onPress={() => openRateEditor('Mortgage')} />
          <Button title="Rates" variant="secondary" onPress={() => router.push('/(tabs)/browse')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen onLayout={() => setLayoutReady(true)}>
      <ScreenScrollView
        ref={scrollRef}
        showDataHealthBanner={false}
        contentContainerStyle={{ paddingBottom: snack ? 96 : 48, gap: 16 }}
      >
        {profileDetailsPending && !detailsLoading ? (
          <Card variant="outlined" style={{ gap: theme.spacing(2) }}>
            <AppText variant="small" weight="700">{uiLabel("Matching details unavailable")}</AppText>
            <Button
              title="Retry matching"
              variant="secondary"
              onPress={() => void ensureDetails({ force: true, abandonInFlight: true })}
            />
          </Card>
        ) : null}

        <SectionHeading
          title="Saved rates"
          action={items.length >= 2 ? (
            <Button
              title={uiLabel(selectMode ? 'Done' : 'Compare')}
              variant="secondary"
              onPress={toggleCompareMode}
            />
          ) : undefined}
        />
        {unavailableRefs.length ? (
          <View style={{ gap: 8 }}>
            <AppText variant="small" color="textMuted">
              {uiJoin('Unavailable tiers',': ',uiCount(unavailableRefs.length))}
            </AppText>
            {unavailableRefs.map(ref => <Button key={ref.id} title="Choose product"
              variant="ghost" onPress={() => openProduct(ref.productKey)} />)}
            <Button
              title="Remove unavailable saves"
              variant="secondary"
              onPress={() => unavailableRefs.forEach((ref) => removeSavedRate(ref.id))}
            />
          </View>
        ) : null}
        {selectMode && selected.length >= 2 ? (
          <Button title={uiJoin('Compare',' ',uiCount(selected.length))} icon="git-compare" onPress={openSelectedCompare} />
        ) : null}
        {!items.length ? (
          <Card variant="outlined" style={{ gap: theme.spacing(3) }}>
            <AppText variant="small" color="textMuted">{uiLabel("No saved tiers")}</AppText>
            <Button title="Rates" variant="secondary" onPress={() => router.push('/(tabs)/browse')} />
          </Card>
        ) : null}
        {SECTION_ORDER.map((groupSection) => {
          const sectionItems = items.filter((item) => item.section === groupSection);
          if (!sectionItems.length) return null;
          return (
            <View key={groupSection} style={{ gap: 8 }}>
              <AppText variant="small" weight="700" color="textMuted">
                {uiSectionName(groupSection)}
              </AppText>
              <View testID="saved-product-rows">
              {sectionItems.map(({ ref, row, section }) => {
                const token = compareToken(row.product_key, row.rate_index ?? null, row.public_offer_id);
                return <SwipeableRow key={ref.id} onDelete={() => remove(ref.id)} deleteLabel="Stop watching">
                  <ProductCard row={row} section={section} selectMode={selectMode} selected={selected.includes(token)}
                    logoRenderStateId={`saved:${ref.id}`} onLogoRenderStateChange={savedLogos.onLogoRenderStateChange}
                    onPress={() => { if (selectMode) toggleSelection(token); else openSavedProduct(row); }} />
                </SwipeableRow>;
              })}
              </View>
            </View>
          );
        })}
        <Disclosure title="Your entered rates" open={positionsOpen} onToggle={() => setPositionsOpen(open => !open)}>
        {positions.length ? positions.map((position) => {
          const meta = SECTIONS[position.section];
          return (
            <Card
              key={position.section}
              variant="outlined"
              style={{ gap: theme.spacing(3) }}
            >
              <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <AppText variant="small" weight="700">{uiSectionName(position.section)}</AppText>
                <Pressable
                  onPress={() => openRateEditor(position.section)}
                  accessibilityRole="button"
                  accessibilityLabel={uiJoin('Edit',' ',uiSectionName(position.section),' ','Rate')}
                  style={{ minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'flex-end' }}
                >
                  <AppText variant="small" color="primary" weight="700">{uiLabel("Edit")}</AppText>
                </Pressable>
              </Row>
              <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: theme.spacing(4) }}>
                <View>
                  <AppText variant="tiny" color="textMuted">{uiLabel("Current entered rate")}</AppText>
                  <AppText variant="h3">{formatRate(position.currentRate)}</AppText>
                </View>
                {position.matchedRate != null ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <AppText variant="tiny" color="textMuted">{uiLabel("Matched observed rate")}</AppText>
                    <AppText variant="h3" style={{ color: meta.lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit }}>
                      {formatRate(position.matchedRate)}
                    </AppText>
                  </View>
                ) : null}
              </Row>
              <AppText variant="body" weight="700">{positionHeadline(position)}</AppText>
              {position.ready ? (
                <AppText variant="tiny" color="textMuted">{uiJoin('Observed',': ',uiDate(core.run_date))}
                </AppText>
              ) : null}
              {position.section === 'Mortgage' && mortgageRateMetric === 'comparison' ? (
                <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <AppText variant="tiny" color="textMuted">{uiLabel("Match / gap basis")}</AppText>
                  <AppText variant="tiny">{uiLabel("Comparison / advertised")}</AppText>
                </Row>
              ) : null}
            </Card>
          );
        }) : (
          <Card variant="outlined" style={{ gap: theme.spacing(3) }}>
            <Button title="Add my rate" onPress={() => openRateEditor('Mortgage')} />
          </Card>
        )}
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <AppText variant="tiny" color="textMuted">{uiLabel("Entered rates")}</AppText>
          <AppText variant="tiny">{uiLabel("This device")}</AppText>
        </Row>

        </Disclosure>
      </ScreenScrollView>
      <UndoSnackbar snack={snack} onUndo={undo} />

    </Screen>
  );
}
