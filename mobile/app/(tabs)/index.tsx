import Ionicons from '@expo/vector-icons/Ionicons';
import { useIsFocused, useScrollToTop } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { HomeHero } from '../../src/components/HomeHero';
import { ProductCard } from '../../src/components/ProductCard';
import { IndeterminateProgressBar, LoadingRows, ScreenSkeleton } from '../../src/components/feedback';
import { ScreenScrollView } from '../../src/components/Screen';
import { SectionCrossfade, SegmentedControl } from '../../src/components/controls';
import { AppText, Button, Card, Row } from '../../src/components/ui';
import { SECTIONS } from '../../src/constants';
import { formatRate, formatRunDate, relativeDate, toFraction } from '../../src/data/format';
import { computeLvr } from '../../src/data/calc';
import { percentageInputFraction } from '../../src/data/decisionInsights';
import { resolveInterestSection, sectionSegmentOptions } from '../../src/data/interests';
import { resolveSectionRibbonStats } from '../../src/data/ribbonStats';
import { lvrTierForValue, profileFeaturesForSection, profileFilterRows, profileSectionCount } from '../../src/data/profile';
import { bestRow, rankedRateLabelForSection, rankFraction } from '../../src/data/selectors';
import { isSuitabilityFilterReady } from '../../src/data/suitabilityGate';
import { conditionalNote } from '../../src/lib/rateQualifier';
import { ShareQrModal } from '../../src/components/ShareQrModal';
import { rowsUnder } from '../../src/data/taxonomy';
import { useStore } from '../../src/data/store';
import { shouldWarmDetails } from '../../src/data/optionalPrefs';
import { openBank, openProduct } from '../../src/lib/nav';
import { scheduleAfterNavigation } from '../../src/lib/yieldToUi';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import { usePerformanceAuditSurface } from '../../src/hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../../src/hooks/useLogoReadiness';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useUserRateScenario } from '../../src/hooks/useUserRateScenario';
import { StaySwitchChart } from '../../src/components/scenario/StaySwitchChart';
import { buildStaySwitchProjection } from '../../src/data/staySwitchProjection';
import { NOT_LISTED_PROVIDER } from '../../src/data/userRateScenario';
import { freshnessDeadlineUtc } from '../../src/data/displayEvidence';
import { CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT } from '../../src/lib/appHealth';

/**
 * Slim one-line entry point to a secondary tool. Keeps Today's supporting
 * actions from competing with the rate itself for vertical space.
 */
function TodayPrompt({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(3),
        minHeight: 56,
        paddingHorizontal: theme.spacing(4),
        paddingVertical: theme.spacing(3),
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={theme.colors.primary} />
      <View style={{ flex: 1 }}>
        <AppText variant="body" weight="700">{label}</AppText>
        <AppText variant="tiny" color="textMuted">{hint}</AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textFaint} />
    </Pressable>
  );
}

export default function Home() {
  const theme = useTheme();
  const isFocused = useIsFocused();
  const core = useStore((s) => s.core);
  const storeStatus = useStore((s) => s.status);
  const storeError = useStore((s) => s.error);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? '');
  const manifestSchedule = useStore((s) => s.manifest?.schedule ?? null);
  const coreAssetState = useStore((s) => s.coreAssetState);
  const refreshing = useStore((s) => s.refreshing);
  const refresh = useStore((s) => s.refresh);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const detailsLoading = useStore((s) => s.detailsLoading);
  const source = useStore((s) => s.source);
  const offline = useStore((s) => s.offline);
  const pendingIngestRunDate = useStore((s) => s.pendingIngestRunDate);
  const interests = useStore((s) => s.prefs.interests);
  const activeSection = useStore((s) => s.activeSection);
  const setActiveSection = useStore((s) => s.setActiveSection);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const profileFilters = useStore((s) => s.prefs.profileFilters);
  const warmDetails = useStore((s) => shouldWarmDetails(s.prefs, s.subscriptions));
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const suitabilityRevision = useSuitabilityRevision();
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);
  const [shareOpen, setShareOpen] = useState(false);
  const [filterPrepFailed, setFilterPrepFailed] = useState(false);
  const [heroLayoutRevision, setHeroLayoutRevision] = useState<string | null>(null);
  const { scenario: userScenario, storageStatus: scenarioStatus } = useUserRateScenario();
  const filterPrepAttempts = useRef(0);
  // Browse shares the preferred section with Home. Keep the last rendered Home
  // model during a tab/back transition, then derive the new section after the
  // navigation animation. This prevents thousands of rows of synchronous
  // filtering/ranking from competing with the transition itself.
  const [section, setRenderedSection] = useState(() =>
    resolveInterestSection(interests, activeSection),
  );

  useEffect(() => {
    const resolved = resolveInterestSection(interests, activeSection);
    if (resolved !== activeSection) setActiveSection(resolved);
    if (!isFocused || resolved === section) return;
    return scheduleAfterNavigation(() => setRenderedSection(resolved));
  }, [activeSection, interests, isFocused, section, setActiveSection]);

  const changeSection = useCallback((next: typeof section) => {
    // A direct Home interaction should remain immediate; only cross-tab catch-up
    // is deferred until navigation is idle.
    setRenderedSection(next);
    setActiveSection(next);
  }, [setActiveSection]);

  const coreRevision = core ? `${core.run_date}:${coreSha}` : '';
  const filterReady = useMemo(() => {
    void suitabilityRevision;
    return isSuitabilityFilterReady(includeNonStandard);
  }, [includeNonStandard, suitabilityRevision]);

  const profileFeaturesPending =
    profileFeaturesForSection(profileFilters, section).length > 0 && !detailsProducts;
  const ratesReady = filterReady && !profileFeaturesPending;
  const switchProjectionNeedsDetails = section === 'Mortgage'
    && !!userScenario.mortgage.currentRate.trim()
    && !!userScenario.mortgage.years.trim()
    && (!!userScenario.mortgage.loanBalance.trim() || !!userScenario.mortgage.propertyValue.trim());

  useEffect(() => {
    filterPrepAttempts.current = 0;
    setFilterPrepFailed(false);
  }, [coreRevision]);

  useEffect(() => {
    if (!coreRevision || refreshing || (!warmDetails && !profileFeaturesPending && !switchProjectionNeedsDetails)) return;
    let cancelled = false;
    let interaction: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
    // Details are optional and expensive. Warm them after first paint only for
    // preferences or notification filters that genuinely need product detail;
    // the default home path remains core-only after a new ingest.
    const timer = setTimeout(() => {
      interaction = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) void ensureDetails({ force: switchProjectionNeedsDetails });
      });
    }, profileFeaturesPending ? 0 : 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      interaction?.cancel();
    };
  }, [coreRevision, refreshing, warmDetails, profileFeaturesPending, switchProjectionNeedsDetails, ensureDetails]);

  // Standard-only Home needs the details-derived suitability index. Refresh /
  // bootstrap already force-rebuild, but kick ensureDetails here too so the
  // wait UI cannot stall if that post-work has not claimed the load yet.
  // Re-run when a prior load settles still-closed (detailsLoading → false).
  // Profile account-feature picks also force a details load when still pending.
  useEffect(() => {
    if (ratesReady) {
      filterPrepAttempts.current = 0;
      return;
    }
    if (!coreRevision || refreshing || detailsLoading) return;
    if (!profileFeaturesPending && (includeNonStandard || filterReady)) return;
    if (filterPrepAttempts.current >= 3) return;
    filterPrepAttempts.current += 1;
    void ensureDetails({ force: true });
  }, [
    coreRevision,
    refreshing,
    includeNonStandard,
    filterReady,
    ratesReady,
    profileFeaturesPending,
    detailsLoading,
    ensureDetails,
    suitabilityRevision,
  ]);

  // If the load/rebuild settles without opening the gate, exit the permanent
  // "Preparing" progress state and offer retry. Also bound the spinner so a
  // hung details download cannot leave Home waiting forever. Profile feature
  // picks use the same path — they also need details before the hero can run.
  useEffect(() => {
    if (ratesReady || refreshing || !coreRevision) {
      setFilterPrepFailed(false);
      return;
    }
    if (detailsLoading) {
      setFilterPrepFailed(false);
      const hung = setTimeout(() => {
        const stillWaiting =
          !isSuitabilityFilterReady(includeNonStandard) ||
          (profileFeaturesForSection(profileFilters, section).length > 0 &&
            !useStore.getState().details?.products);
        if (stillWaiting) setFilterPrepFailed(true);
      }, 12_000);
      return () => clearTimeout(hung);
    }
    const timer = setTimeout(() => {
      const stillWaiting =
        !isSuitabilityFilterReady(includeNonStandard) ||
        (profileFeaturesForSection(profileFilters, section).length > 0 &&
          !useStore.getState().details?.products);
      if (stillWaiting) setFilterPrepFailed(true);
    }, 400);
    return () => clearTimeout(timer);
  }, [
    ratesReady,
    includeNonStandard,
    refreshing,
    coreRevision,
    detailsLoading,
    suitabilityRevision,
    profileFilters,
    section,
  ]);

  const retryFilterPrep = useCallback(() => {
    setFilterPrepFailed(false);
    filterPrepAttempts.current = 0;
    void ensureDetails({ force: true, abandonInFlight: true });
  }, [ensureDetails]);

  const onRefresh = useCallback(() => void refresh({ manual: true }), [refresh]);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const sectionRows = core?.sections[section]?.rates;
  const sectionData = core?.sections[section];
  const hierRows = useMemo(() => rowsUnder(sectionRows ?? [], section, []), [sectionRows, section]);
  const mortgageScenario = useMemo(() => computeLvr(userScenario.mortgage), [userScenario.mortgage]);
  const scenarioLvrTier = useMemo(() => {
    if (section !== 'Mortgage' || mortgageScenario.lvr == null) return null;
    return lvrTierForValue(
      mortgageScenario.lvr,
      [...new Set((sectionRows ?? []).map((row) => row.lvr_tier).filter((tier): tier is string => !!tier))],
    );
  }, [mortgageScenario.lvr, section, sectionRows]);
  const decisionProfileFilters = useMemo(
    () => scenarioLvrTier ? { ...profileFilters, lvrTiers: [scenarioLvrTier] } : profileFilters,
    [profileFilters, scenarioLvrTier],
  );
  const stats = useMemo(
    () => {
      void suitabilityRevision;
      return resolveSectionRibbonStats(
        sectionData,
        hierRows,
        includeNonStandard,
        section,
        detailsProducts,
        depositRankMetric,
        mortgageRateMetric,
      );
    },
    [sectionData, hierRows, includeNonStandard, section, detailsProducts, depositRankMetric, mortgageRateMetric, suitabilityRevision],
  );
  // The hero "best" honours the saved product profile (e.g. OO, P&I, your LVR,
  // and must-have account features once details are warm).
  const profileCount = profileSectionCount(decisionProfileFilters, section);
  const best = useMemo(
    () => {
      void suitabilityRevision;
      const scoped = bestRow(
        profileFilterRows(hierRows, decisionProfileFilters, section, detailsProducts),
        section,
        includeNonStandard,
        depositRankMetric,
        detailsProducts,
        mortgageRateMetric,
      );
      if (scoped) return scoped;
      // Root hierarchy and flat-section scopes usually contain the same
      // products. Only pay for the broader fallback when the hierarchy scope
      // genuinely produced no eligible winner.
      return bestRow(
        profileFilterRows(sectionRows ?? [], decisionProfileFilters, section, detailsProducts),
        section,
        includeNonStandard,
        depositRankMetric,
        detailsProducts,
        mortgageRateMetric,
      );
    },
    [hierRows, sectionRows, decisionProfileFilters, section, includeNonStandard, depositRankMetric, mortgageRateMetric, detailsProducts, suitabilityRevision],
  );

  const meta = SECTIONS[section];
  const activeBest = ratesReady ? best : null;
  // Show the ranked best product's own rate (base ongoing by default) so the
  // headline can't overstate what the winner actually pays; with a profile active,
  // show nothing (not the market extreme) when nothing matches.
  const heroBest = activeBest ? rankFraction(activeBest, section, depositRankMetric, mortgageRateMetric) : null;
  const heroRate = !ratesReady
    ? null
    : profileCount > 0
      ? heroBest
      : heroBest ?? (meta.lowerIsBetter ? stats.min : stats.max);
  const heroRateLabel = section === 'Mortgage'
    ? mortgageRateMetric === 'comparison' ? 'Comparison rate' : 'Interest rate'
    : section === 'Savings' && depositRankMetric === 'base'
      ? 'Ongoing rate'
      : section === 'Savings'
        ? 'Maximum rate'
        : 'Rate';
  const scenarioSummary = useMemo(() => {
    if (section === 'Mortgage') {
      return { currentRate: percentageInputFraction(userScenario.mortgage.currentRate) };
    }
    const deposit = section === 'Savings' ? userScenario.savings : userScenario.termDeposit;
    return { currentRate: percentageInputFraction(deposit.currentRate) };
  }, [section, userScenario]);
  const loyaltyComparisonRate = section === 'Mortgage' && activeBest
    ? toFraction(activeBest.rate)
    : heroRate;
  const observedGapRate = loyaltyComparisonRate != null && scenarioSummary.currentRate != null
    ? Math.max(
        0,
        section === 'Mortgage'
          ? scenarioSummary.currentRate - loyaltyComparisonRate
          : loyaltyComparisonRate - scenarioSummary.currentRate,
      )
    : null;
  const staySwitchProjection = useMemo(() => {
    if (section !== 'Mortgage' || !activeBest) return null;
    const currentRef = userScenario.currentProducts.mortgage;
    return buildStaySwitchProjection({
      scenario: userScenario,
      target: activeBest,
      currentDetail: currentRef.productKey ? detailsProducts?.[currentRef.productKey] : null,
      targetDetail: detailsProducts?.[activeBest.product_key],
    });
  }, [activeBest, detailsProducts, section, userScenario]);
  const currentBankLabel = userScenario.currentProducts.mortgage.provider
    && userScenario.currentProducts.mortgage.provider !== NOT_LISTED_PROVIDER
    ? userScenario.currentProducts.mortgage.provider
    : 'Current bank';
  const shareMessage = useMemo(() => {
    if (!core) return null;
    if (heroRate == null) return null; // nothing worth sharing until rates are loaded
    const direction = meta.lowerIsBetter ? 'Lowest' : 'Highest';
    const rateLabel = rankedRateLabelForSection(section, depositRankMetric, mortgageRateMetric).toLowerCase();
    return [
      `${direction} ${rateLabel} today: ${formatRate(heroRate)} (${formatRunDate(core.run_date)})`,
      `Observed across ${Object.keys(core.brands ?? {}).length} Australian banks and lenders.`,
    ].join('\n');
  }, [core, depositRankMetric, heroRate, meta.lowerIsBetter, mortgageRateMetric, section]);
  const shareToday = useCallback(() => setShareOpen(true), []);

  const auditSelectSection = useCallback((...args: unknown[]) => {
    void args;
    const currentIndex = sectionOptions.findIndex((option) => option.value === section);
    const next = sectionOptions[(currentIndex + 1) % Math.max(1, sectionOptions.length)]?.value;
    if (next) changeSection(next);
  }, [changeSection, section, sectionOptions]);
  const openBestProduct = useCallback(() => {
    if (!activeBest) {
      return { unavailableReason: 'No ranked best product is available on the mounted Today card' };
    }
    openProduct(activeBest.product_key, activeBest.rate_index);
    return { expectedPath: `/product/${encodeURIComponent(activeBest.product_key)}` };
  }, [activeBest]);
  const todayRenderRevision = core
    ? `${core.run_date}:${section}:${ratesReady ? heroRate ?? 'na' : 'warming'}`
    : `none:${section}`;
  const todayLogoIds = useMemo(
    () => activeBest ? [`today-best:${activeBest.product_key}:${activeBest.rate_index ?? 'none'}`] : [],
    [activeBest],
  );
  const todayLogos = useLogoReadiness(todayRenderRevision, todayLogoIds);
  const auditActions = useMemo(() => ({
    'today.open': () => undefined,
    'today.section.next': auditSelectSection,
    'today.best.open': openBestProduct,
    'redirect.root.verify': () => undefined,
  }), [auditSelectSection, openBestProduct]);
  usePerformanceAuditSurface({
    id: 'today.hero',
    routeKey: '/',
    datasetRevision: coreRevision || null,
    renderRevision: todayRenderRevision,
    actions: auditActions,
    probes: [
      {
        id: 'today.data',
        kind: 'data',
        status: core ? 'ready' : storeStatus === 'error' ? 'error' : 'pending',
        error: !core && storeStatus === 'error' ? storeError ?? 'Core data unavailable' : null,
        datasetRevision: coreRevision || null,
      },
      {
        id: 'today.suitability',
        kind: 'data',
        status: ratesReady ? 'ready' : filterPrepFailed ? 'error' : 'pending',
        error: filterPrepFailed ? 'Filtered rates did not become ready' : null,
        datasetRevision: coreRevision || null,
      },
      {
        id: 'today.details',
        kind: 'data',
        status: !profileFeaturesPending || detailsProducts
          ? 'ready'
          : filterPrepFailed
            ? 'error'
            : 'pending',
        error: profileFeaturesPending && filterPrepFailed
          ? 'Profile-required product details did not become ready'
          : null,
        expectedCount: profileFeaturesPending ? 1 : 0,
        actualCount: profileFeaturesPending && detailsProducts ? 1 : 0,
      },
      {
        id: 'today.best-card',
        kind: 'list',
        status: ratesReady ? 'ready' : 'pending',
        expectedCount: activeBest ? 1 : 0,
        actualCount: activeBest ? 1 : 0,
      },
      {
        id: 'today.logo',
        kind: 'logo',
        status: todayLogos.ready ? 'ready' : 'pending',
        expectedCount: todayLogos.expectedCount,
        actualCount: todayLogos.terminalCount,
        fallbackCount: todayLogos.fallbackCount,
      },
      {
        id: 'today.hero-layout',
        kind: 'graphic',
        status: heroLayoutRevision === todayRenderRevision ? 'ready' : 'pending',
        renderRevision: todayRenderRevision,
      },
    ],
  });

  if (!core) return <ScreenSkeleton />;
  // `ribbon.counts` is optional in the payload and core JSON is not runtime
  // schema-validated, so fall back to the loaded rows rather than claiming
  // "0 products", and drop the count entirely if neither source has one.
  const lenderCount = Object.keys(core.brands ?? {}).length;
  const productCount =
    Object.values(core.sections).reduce((sum, value) => sum + (value.ribbon?.counts?.products ?? 0), 0) ||
    new Set(
      Object.values(core.sections).flatMap((value) =>
        (value.rates ?? []).map((rateRow) => rateRow.product_key),
      ),
    ).size;
  const coverageLabel = productCount
    ? `${productCount.toLocaleString()} products from ${lenderCount} lenders`
    : `${lenderCount} lenders`;
  const sectionAccent = meta.accentColor;
  const bestNote = conditionalNote(activeBest, section);

  return (
    <ScreenScrollView
      ref={scrollRef}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
    >
      <View
        key={`today-hero-${todayRenderRevision}`}
        onLayout={() => setHeroLayoutRevision(todayRenderRevision)}
      >
      <HomeHero
        dataKey={core.run_date}
        runDate={core.run_date}
        runDateLabel={formatRunDate(core.run_date)}
        runAgeLabel={relativeDate(`${core.run_date}T00:00:00Z`)}
        source={source}
        offline={offline}
        pendingIngest={!!pendingIngestRunDate && !offline}
        onShare={shareToday}
        coverageLabel={coverageLabel}
        coverage={core.coverage}
        assetStatus={coreAssetState.status}
        assetReason={coreAssetState.status === 'partial'
          ? coreAssetState.reason
          : coreAssetState.status === 'unavailable'
            ? coreAssetState.reason
            : coreAssetState.status === 'error'
              ? coreAssetState.error
              : null}
        overdueAfterUtc={freshnessDeadlineUtc(
          manifestSchedule?.next_due_utc,
          CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT.freshnessGraceMs,
        )}
        scheduleLabel={manifestSchedule?.label ?? null}
      />
      </View>

      {sectionOptions.length > 1 ? (
        <SegmentedControl options={sectionOptions} value={section} onChange={changeSection} />
      ) : null}

      {scenarioStatus === 'ready' && scenarioSummary.currentRate != null ? (
        <Card style={{ borderColor: `${meta.accentColor}55`, gap: theme.spacing(2) }}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <AppText variant="h3">Your rate today</AppText>
            <Pressable
              onPress={() => router.push('/calculator')}
              accessibilityRole="button"
              accessibilityLabel={`Edit my ${meta.title.toLowerCase()} rate`}
              hitSlop={10}
            >
              <AppText variant="small" color="primary" weight="700">Edit</AppText>
            </Pressable>
          </Row>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <AppText variant="tiny" color="textMuted">Current entered rate</AppText>
              <AppText variant="h3">{formatRate(scenarioSummary.currentRate)}</AppText>
            </View>
            {ratesReady && loyaltyComparisonRate != null ? (
              <View style={{ alignItems: 'flex-end' }}>
                <AppText variant="tiny" color="textMuted">Matched observed rate</AppText>
                <AppText
                  variant="h3"
                  style={{ color: meta.lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit }}
                >
                  {formatRate(loyaltyComparisonRate)}
                </AppText>
              </View>
            ) : null}
          </Row>
          <AppText variant="body" weight="700">
            {!ratesReady
              ? 'Matching today’s observed rates…'
              : observedGapRate == null
              ? 'No matched comparison is available today'
              : observedGapRate <= 0
                ? 'No better matched rate observed today'
                : `${(observedGapRate * 100).toFixed(2)} percentage point gap`}
          </AppText>
          <AppText variant="tiny" color="textMuted">
            Matched to your filters · observed {formatRunDate(core.run_date)}.
          </AppText>
          {section === 'Mortgage' && mortgageRateMetric === 'comparison' ? (
            <AppText variant="tiny" color="textMuted">
              Product matched by comparison rate; the gap uses its advertised rate.
            </AppText>
          ) : null}
          {activeBest ? (
            <Button title="View matched rate" variant="secondary" onPress={openBestProduct} />
          ) : null}
        </Card>
      ) : scenarioStatus === 'ready' ? (
        <Card variant="outlined" style={{ gap: theme.spacing(3) }}>
          <View>
            <AppText variant="h3">Check my rate</AppText>
            <AppText variant="small" color="textMuted" style={{ marginTop: 2 }}>
              See your observed gap without linking a bank account.
            </AppText>
          </View>
          <Button
            title="Add my rate"
            onPress={() => router.push({ pathname: '/calculator', params: { intent: 'check', section } })}
          />
          <AppText variant="tiny" color="textMuted">Entered amounts stay on this device.</AppText>
        </Card>
      ) : null}

      {staySwitchProjection?.ready ? (
        <StaySwitchChart
          projection={staySwitchProjection}
          currentBank={currentBankLabel}
          compact
          onOpenFull={() => router.push({
            pathname: '/projections',
            params: {
              section: 'Mortgage',
              target: activeBest?.product_key,
              ri: activeBest?.rate_index != null ? String(activeBest.rate_index) : undefined,
            },
          } as never)}
        />
      ) : null}

      <SectionCrossfade section={section}>
      <Card variant="outlined" style={{ borderColor: `${sectionAccent}44` }}>
        {!ratesReady ? (
          <View style={{ gap: theme.spacing(3) }}>
            <View>
              <AppText variant="tiny" color="textFaint" weight="700">
                MARKET REFERENCE
              </AppText>
              <AppText variant="small" color="textMuted" style={{ marginTop: theme.spacing(1) / 2 }}>
                {filterPrepFailed
                  ? 'Could not prepare filtered rates for today.'
                  : profileFeaturesPending
                    ? 'Matching your profile…'
                    : 'Finding today’s observed rate…'}
              </AppText>
            </View>
            {filterPrepFailed ? (
              <Button title="Retry" variant="secondary" onPress={retryFilterPrep} />
            ) : (
              <>
                <IndeterminateProgressBar
                  caption="Applying your filter settings to today’s rates."
                  accessibilityLabel="Finding today’s observed rate"
                />
                <LoadingRows count={1} />
              </>
            )}
          </View>
        ) : (
          <>
            <View style={{ marginBottom: activeBest ? theme.spacing(4) : 0 }}>
              <AppText variant="h3">
                {meta.lowerIsBetter ? 'Lowest matched rate' : 'Highest matched rate'}
              </AppText>
              <AppText variant="small" color="textMuted" style={{ marginTop: 2 }}>
                {meta.title}{profileCount > 0 ? ' · matched to your profile' : ' · broadly available'}
              </AppText>
              {!activeBest ? (
                <AppText
                  variant="rateHero"
                  style={{
                    color: meta.lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit,
                    marginTop: theme.spacing(2),
                  }}
                >
                  {formatRate(heroRate)}
                </AppText>
              ) : null}
            </View>
            {activeBest ? (
              <ProductCard
                row={activeBest}
                section={section}
                embedded
                heroRate
                displayedRate={heroRate}
                displayedRateLabel={heroRateLabel}
                onPress={openBestProduct}
                onLongPress={() => openBank(activeBest.provider)}
                logoRenderStateId={todayLogoIds[0]}
                onLogoRenderStateChange={todayLogos.onLogoRenderStateChange}
              />
            ) : null}
            {bestNote ? (
              <AppText
                variant="small"
                weight="700"
                style={{ color: theme.colors.warning, marginTop: theme.spacing(2) }}
              >
                {bestNote}
              </AppText>
            ) : null}
            {profileCount === 0 ? (
              // Personalisation is offered here, against a real result, rather
              // than as a wall of chips during onboarding.
              <Pressable
                onPress={() => router.push('/profile')}
                accessibilityRole="button"
                accessibilityLabel="Refine what matches me"
                accessibilityHint="Set the loan or account attributes that apply to you"
                style={({ pressed }) => ({
                  marginTop: theme.spacing(3),
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <AppText variant="small" color="primary" weight="700">
                  Refine what matches me
                </AppText>
              </Pressable>
            ) : null}
          </>
        )}
      </Card>
      </SectionCrossfade>

      <TodayPrompt
        icon="analytics-outline"
        label="Project my balance over time"
        hint="Repayments, offset plans and rate scenarios"
        onPress={() => router.push({ pathname: '/projections', params: { section } } as never)}
      />

      <ShareQrModal visible={shareOpen} onClose={() => setShareOpen(false)} shareMessage={shareMessage} />
    </ScreenScrollView>
  );
}
