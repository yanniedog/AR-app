import { uiCount, uiDate, uiInputNumber, uiJoin, uiLabel, uiNumber, uiSectionName, type UiCopy, type UiText } from "../../src/lib/uiCopy";
import { mandatoryEligibleRows, mandatoryProductAllowed } from '../../src/data/eligibilityGate';
import { fontStyle } from '../../src/theme/fonts';
import Ionicons from '../../src/components/icons/AppIcon';
import { useScrollToTop } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';

import { EmptyState, ScreenSkeleton } from '../../src/components/feedback';
import { ProductCard } from '../../src/components/ProductCard';
import { Screen, ScreenScrollView } from '../../src/components/Screen';
import { UndoSnackbar } from '../../src/components/Snackbar';
import { SwipeableRow } from '../../src/components/SwipeableRow';
import { AppText, Button, Card, Disclosure, Row, SectionHeading } from '../../src/components/ui';
import { SECTION_ORDER, SECTIONS } from '../../src/constants';
import { computeLvr } from '../../src/data/calc';
import { toggleCompareSelection } from '../../src/data/compareSelection';
import { percentageInputFraction } from '../../src/data/decisionInsights';
import { formatRate, toFraction } from '../../src/data/format';
import { ensurePermissions } from '../../src/data/notifications';
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
import { bestRow, rankFraction } from '../../src/data/selectors';
import { useStore } from '../../src/data/store';
import { isSuitabilityFilterReady } from '../../src/data/suitabilityGate';
import {
  normalizeTrackedRates,
  queueTrackedRatesSecureSave,
  type TrackedRate,
  type TrackedRateDateKind,
} from '../../src/data/trackedRates';
import { useLogoReadiness } from '../../src/hooks/useLogoReadiness';
import { usePerformanceAuditSurface } from '../../src/hooks/usePerformanceAuditReadiness';
import { useReducedMotion } from '../../src/hooks/useReducedMotion';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import { useUndoSnackbar } from '../../src/hooks/useUndoSnackbar';
import { useUserRateScenario } from '../../src/hooks/useUserRateScenario';
import { openCompare, openProduct } from '../../src/lib/nav';
import { buildCalculationRoute } from '../../src/lib/calculationTarget';
import {
  auditActionString,
  auditActionStrings,
} from '../../src/lib/performanceAuditActionParams';
import { useTheme } from '../../src/theme/ThemeProvider';
import type { RateRow, SectionKey } from '../../src/types';
import { savedEmptyState } from '../../src/lib/savedEmptyState';

function compareToken(productKey: string, rateIndex: number | null): string {
  return rateIndex == null ? productKey : `${rateIndex}#${productKey}`;
}

interface RatePosition {
  section: SectionKey;
  currentRate: number;
  matchedRate: number | null;
  gapRate: number | null;
  ready: boolean;
}

interface DateEditorState {
  id: string;
  kind: TrackedRateDateKind;
  value: string;
}

function positionHeadline(position: RatePosition): UiCopy {
  if (!position.ready) return 'Matching';
  if (position.matchedRate == null || position.gapRate == null) {
    return 'Matched rate unavailable';
  }
  if (position.gapRate <= 0) return 'No better matched rate';
  return uiJoin('Gap',': ',uiNumber(position.gapRate*100,2),' ','percentage points');
}

function dateLabel(tracked: TrackedRate | undefined): UiText | null {
  if (!tracked?.relevantDate || !tracked.relevantDateKind) return null;
  return uiJoin(tracked.relevantDateKind==='term-maturity'?'Matures':'Fixed rate ends',': ',uiDate(tracked.relevantDate));
}

let auditSavedFixtureSnapshot: {
  savedRates: SavedRateRef[];
  trackedRates: TrackedRate[];
  favorites: string[];
} | null = null;

export default function MyRates() {
  const theme = useTheme();
  const [positionsOpen, setPositionsOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const core = useStore((s) => s.core);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? '');
  const storeStatus = useStore((s) => s.status);
  const storeError = useStore((s) => s.error);
  const savedRates = useStore((s) => s.savedRates);
  const trackedRates = useStore((s) => s.trackedRates);
  const removeSavedRate = useStore((s) => s.removeSavedRate);
  const restoreSavedRate = useStore((s) => s.restoreSavedRate);
  const subscriptions = useStore((s) => s.subscriptions);
  const notificationsEnabled = useStore((s) => s.prefs.notificationsEnabled);
  const subscribeProduct = useStore((s) => s.subscribeProduct);
  const unsubscribeProduct = useStore((s) => s.unsubscribeProduct);
  const isProductSubscribed = useStore((s) => s.isProductSubscribed);
  const setPref = useStore((s) => s.setPref);
  const setTrackedRateRelevantDate = useStore((s) => s.setTrackedRateRelevantDate);
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
  const [dateEditor, setDateEditor] = useState<DateEditorState | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const items = useMemo(() => (core ? resolveSavedRates(core, savedRates).filter(item => mandatoryEligibleRows([item.row]).length > 0) : []), [core, savedRates, suitabilityRevision]);
  const unavailableRefs = useMemo(
    () => unresolvedSavedRateRefs(savedRates.filter(ref => mandatoryProductAllowed(ref.productKey)), items),
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
      const deposit = section === 'Savings' ? scenario.savings : scenario.termDeposit;
      const currentRate = section === 'Mortgage'
        ? percentageInputFraction(scenario.mortgage.currentRate)
        : percentageInputFraction(deposit.currentRate);
      if (currentRate == null) return [];
      const rows = core.sections[section]?.rates ?? [];
      const ready = isSuitabilityFilterReady(includeNonStandard)
        && !(profileFeaturesForSection(profileFilters, section).length > 0 && !detailsProducts);
      if (!ready) {
        return [{
          section,
          currentRate,
          matchedRate: null,
          gapRate: null,
          ready: false,
        }];
      }
      const match = bestRow(
        scenarioProfileFilterRows(rows, profileFilters, section, mortgage.lvr, detailsProducts),
        section,
        includeNonStandard,
        depositRankMetric,
        detailsProducts,
        mortgageRateMetric,
      );
      // A comparison-rate ranking may select the mortgage product, but its
      // observed interest rate is the like-for-like input for dollar impact.
      const matchedRate = match
        ? section === 'Mortgage'
          ? toFraction(match.rate)
          : rankFraction(match, section, depositRankMetric, mortgageRateMetric)
        : null;
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
    const update = toggleCompareSelection(core, selected, token);
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
  }, [core, selected]);
  const findExactRow = useCallback((token: string): RateRow | null => {
    if (!core) return null;
    const hash = token.indexOf('#');
    const rateIndex = hash > 0 && Number.isInteger(Number(token.slice(0, hash)))
      ? Number(token.slice(0, hash))
      : null;
    const productKey = rateIndex == null ? token : token.slice(hash + 1);
    for (const section of Object.values(core.sections)) {
      const exact = section.rates.find((row) =>
        row.product_key === productKey && (rateIndex == null || row.rate_index === rateIndex));
      if (exact) return exact;
    }
    return null;
  }, [core]);
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
        Number.isInteger(row.rate_index) ? 'rate' : 'product',
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
  const toggleAlert = useCallback(async (row: RateRow) => {
    const rateIndex = row.rate_index ?? null;
    const storedSubscription = isProductSubscribed(row.product_key, rateIndex);
    if (storedSubscription && notificationsEnabled) {
      unsubscribeProduct(row.product_key, rateIndex);
      return;
    }
    const permitted = await ensurePermissions();
    if (!permitted) {
      Alert.alert('Notifications disabled');
      return;
    }
    if (!notificationsEnabled) setPref('notificationsEnabled', true);
    if (!storedSubscription) subscribeProduct(row.product_key, rateIndex, row);
  }, [isProductSubscribed, notificationsEnabled, setPref, subscribeProduct, unsubscribeProduct]);

  const coreRevision = core ? `${core.run_date}:${coreSha}` : null;
  const savedRenderRevision = `${coreRevision ?? 'none'}:${positions.length}:${items.length}:${unavailableRefs.length}:${subscriptions.length}:${selectMode ? 'select' : 'view'}:${selected.join(',')}`;
  const savedLogoIds = useMemo(
    () => selectMode ? [] : items.map(({ ref }) => `saved:${ref.id}`),
    [items, selectMode],
  );
  const savedLogos = useLogoReadiness(savedRenderRevision, savedLogoIds);
  const calculateSavedRate = useCallback((row: RateRow, section: SectionKey) => {
    router.push(buildCalculationRoute(row, section));
    return { expectedPath: '/calculator' };
  }, []);
  const calculateSavedRateForAudit = useCallback((...args: unknown[]) => {
    if (selectMode) return { unavailableReason: 'Saved rate calculation is unavailable during comparison selection' };
    const id = auditActionString(args, 'savedId');
    const item = id ? items.find(value => value.ref.id === id) : items[0];
    if (!item) return { unavailableReason: 'Selected saved rate is unavailable' };
    return calculateSavedRate(item.row, item.section);
  }, [calculateSavedRate, items, selectMode]);
  const auditActions = useMemo(() => ({
    'saved.open': () => undefined,
    'saved.calculate.open': calculateSavedRateForAudit,
    'saved.fixture.ensure-exact-pair': ensureExactPair,
    'saved.compare.mode': toggleCompareMode,
    'saved.compare.select.0': selectAuditToken,
    'saved.compare.select.1': selectAuditToken,
    'saved.compare.open': openSelectedCompare,
    'saved.fixture.restore': restoreSavedFixture,
  }), [calculateSavedRateForAudit, ensureExactPair, openSelectedCompare, restoreSavedFixture, selectAuditToken, toggleCompareMode]);
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
      token !== compareToken(item.row.product_key, item.row.rate_index ?? null)));
    showUndo('Removed', () => {
      restoreSavedRate(item.ref, tracked);
    });
  }, [items, removeSavedRate, restoreSavedRate, showUndo, trackedById]);

  const saveRelevantDate = useCallback(async () => {
    if (!dateEditor) return;
    try {
      await setTrackedRateRelevantDate(
        dateEditor.id,
        dateEditor.value.trim() || null,
        dateEditor.value.trim() ? dateEditor.kind : null,
      );
      setDateEditor(null);
    } catch (error) {
      Alert.alert(
        error instanceof RangeError ? 'Invalid date' : 'Date not saved',
        error instanceof RangeError ? 'YYYY-MM-DD' : 'Storage unavailable · Previous date retained',
      );
    }
  }, [dateEditor, setTrackedRateRelevantDate]);

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
              {sectionItems.map(({ ref, row, section }) => {
                const token = compareToken(row.product_key, row.rate_index ?? null);
                const selectedNow = selected.includes(token);
                const tracked = trackedById.get(ref.id);
                const subscribed = notificationsEnabled
                  && isProductSubscribed(row.product_key, row.rate_index ?? null);
                const currentRate = toFraction(row.rate);
                const changeBps = tracked?.observedRate != null && currentRate != null
                  ? Math.round((currentRate - tracked.observedRate) * 10_000)
                  : 0;
                const relevantDate = dateLabel(tracked);
                const supportsRelevantDate = section === 'TD'
                  || tracked?.relevantDateKind === 'fixed-rate-end'
                  || row.rate_type?.toUpperCase().includes('FIXED')
                  || row.ribbon_rate_structure?.toLowerCase() === 'fixed';
                return (
                  <SwipeableRow
                    key={ref.id}
                    onDelete={() => remove(ref.id)}
                    deleteLabel="Stop watching"
                  >
                    <View style={{ gap: 6 }}>
                      <ProductCard
                        row={row}
                        section={section}
                        selectMode={selectMode}
                        selected={selectedNow}
                        logoRenderStateId={`saved:${ref.id}`}
                        onLogoRenderStateChange={savedLogos.onLogoRenderStateChange}
                        onPress={() => {
                          if (!selectMode) {
                            openProduct(row.product_key, row.rate_index);
                            return;
                          }
                          toggleSelection(token);
                        }}
                      />
                      {!selectMode ? (
                        <>
                          <Row
                            style={{
                              justifyContent: 'space-between',
                              paddingHorizontal: theme.spacing(2),
                              paddingBottom: theme.spacing(1),
                            }}
                          >
                          <View style={{ flex: 1 }}>
                            <AppText variant="tiny" color="textMuted">
                              {ref.scope === 'product'
                                ? uiLabel('All product variants · Legacy save')
                                : changeBps
                                ? uiJoin(changeBps>0?'Increase':'Decrease',': ',uiNumber(Math.abs(changeBps)/100,2),' ','percentage points',' · ','Since saved')
                                : uiJoin('Last updated',': ',uiDate(row.last_updated??core.run_date))}
                              {relevantDate ? uiJoin(' · ',relevantDate):null}
                            </AppText>
                          </View>
                          <Button
                            title="Calculate"
                            variant="ghost"
                            onPress={() => calculateSavedRate(row, section)}
                          />
                          <Pressable
                            onPress={() => void toggleAlert(row)}
                            accessibilityRole="button"
                            accessibilityLabel={subscribed ? uiLabel("Disable alerts") : uiLabel("Enable alerts")}
                            hitSlop={10}
                            style={({ pressed }) => ({
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              opacity: pressed ? 0.6 : 1,
                            })}
                          >
                            <Ionicons
                              name={subscribed ? 'notifications' : 'notifications-outline'}
                              size={16}
                              color={subscribed ? theme.colors.primary : theme.colors.textMuted}
                            />
                            <AppText variant="tiny" color={subscribed ? 'primary' : 'textMuted'} weight="700">
                              {subscribed ? uiLabel("Alerts on") : uiLabel("Alert me")}
                            </AppText>
                          </Pressable>
                          </Row>
                          {supportsRelevantDate ? (
                          <Pressable
                            onPress={() => setDateEditor({
                              id: ref.id,
                              kind: section === 'TD' ? 'term-maturity' : 'fixed-rate-end',
                              value: tracked?.relevantDate ?? '',
                            })}
                            accessibilityRole="button"
                            accessibilityLabel={relevantDate
                              ? uiJoin('Edit',' ',relevantDate)
                              : section === 'TD'
                                ? uiLabel("Add term deposit maturity date")
                                : uiLabel("Add fixed rate end date")}
                            style={({ pressed }) => ({
                              minHeight: 48,
                              marginHorizontal: theme.spacing(2),
                              paddingHorizontal: theme.spacing(2),
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 6,
                              opacity: pressed ? 0.6 : 1,
                            })}
                          >
                            <Ionicons name="calendar-outline" size={17} color={theme.colors.textMuted} />
                            <AppText variant="small" color="textMuted" weight="700">
                              {relevantDate ?? (section === 'TD' ? uiLabel("Add maturity date") : uiLabel("Add fixed-rate end date"))}
                            </AppText>
                          </Pressable>
                          ) : null}
                        </>
                      ) : null}
                    </View>
                  </SwipeableRow>
                );
              })}
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
      <Modal
        visible={dateEditor != null}
        transparent
        animationType={reducedMotion === false ? 'fade' : 'none'}
        onRequestClose={() => setDateEditor(null)}
      >
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Card accessibilityViewIsModal style={{ gap: 14 }}>
            <View>
              <AppText variant="h3">
                {dateEditor?.kind === 'term-maturity' ? uiLabel("Term deposit maturity") : uiLabel("Fixed-rate end")}
              </AppText>
              <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <AppText variant="tiny" color="textMuted">{uiLabel("Storage")}</AppText>
                <AppText variant="tiny">{uiJoin('This device',' · ','Private')}</AppText>
              </Row>
            </View>
            <TextInput
              value={uiInputNumber(dateEditor?.value??'')}
              onChangeText={(value) => setDateEditor((current) => current ? { ...current, value } : current)}
              placeholder={uiLabel('YYYY-MM-DD')}
              placeholderTextColor={theme.colors.textFaint}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              inputMode="numeric"
              maxLength={10}
              accessibilityLabel="Date"
              style={{
                ...fontStyle(),
                minHeight: 48,
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radius.md,
                paddingHorizontal: 12,
                color: theme.colors.text,
                backgroundColor: theme.colors.surfaceAlt,
                fontSize: theme.font.body,
              }}
            />
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {dateEditor?.value ? (
                <Button
                  title="Remove date"
                  variant="ghost"
                  onPress={() => setDateEditor((current) => current ? { ...current, value: '' } : current)}
                />
              ) : null}
              <View style={{ flex: 1 }} />
              <Button title="Cancel" variant="secondary" onPress={() => setDateEditor(null)} />
              <Button title="Save date" onPress={saveRelevantDate} />
            </Row>
          </Card>
        </View>
      </Modal>
    </Screen>
  );
}
