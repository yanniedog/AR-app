import { useScrollToTop } from '@react-navigation/native';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { HomeHero, SpringOnNewData } from '../../src/components/HomeHero';
import { ProductCard } from '../../src/components/ProductCard';
import { IndeterminateProgressBar, LoadingRows } from '../../src/components/feedback';
import { ScreenScrollView } from '../../src/components/Screen';
import { SectionCrossfade, SegmentedControl } from '../../src/components/controls';
import { AppText, Button, Card, Row } from '../../src/components/ui';
import { SECTIONS } from '../../src/constants';
import { formatRate, formatRunDate, relativeDate, toFraction } from '../../src/data/format';
import { computeLvr, num } from '../../src/data/calc';
import { loyaltyGapInsight } from '../../src/data/decisionInsights';
import { resolveInterestSection, sectionSegmentOptions } from '../../src/data/interests';
import { resolveSectionRibbonStats } from '../../src/data/ribbonStats';
import { profileFeaturesForSection, profileFilterRows, profileSectionCount } from '../../src/data/profile';
import { bestRow, rankFraction } from '../../src/data/selectors';
import { isSuitabilityFilterReady } from '../../src/data/suitabilityGate';
import { conditionalNote } from '../../src/lib/rateQualifier';
import { ShareQrModal } from '../../src/components/ShareQrModal';
import { rowsUnder } from '../../src/data/taxonomy';
import { useStore } from '../../src/data/store';
import { shouldWarmDetails } from '../../src/data/optionalPrefs';
import { APK_RELEASE_TAG, REPO } from '../../src/config';
import { openBank, openProduct } from '../../src/lib/nav';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import { useTheme } from '../../src/theme/ThemeProvider';
import { EMPTY_USER_RATE_SCENARIO, loadUserRateScenario } from '../../src/data/userRateScenario';

export default function Home() {
  const theme = useTheme();
  const core = useStore((s) => s.core);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? '');
  const refreshing = useStore((s) => s.refreshing);
  const refresh = useStore((s) => s.refresh);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const detailsLoading = useStore((s) => s.detailsLoading);
  const source = useStore((s) => s.source);
  const offline = useStore((s) => s.offline);
  const pendingIngestRunDate = useStore((s) => s.pendingIngestRunDate);
  const interests = useStore((s) => s.prefs.interests);
  const section = useStore((s) => s.activeSection);
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
  const [userScenario, setUserScenario] = useState(EMPTY_USER_RATE_SCENARIO);
  const filterPrepAttempts = useRef(0);

  useEffect(() => {
    let active = true;
    void loadUserRateScenario().then((value) => {
      if (active) setUserScenario(value);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const resolved = resolveInterestSection(interests, section);
    if (resolved !== section) setActiveSection(resolved);
  }, [interests, section, setActiveSection]);

  const coreRevision = core ? `${core.run_date}:${coreSha}` : '';
  const filterReady = useMemo(() => {
    void suitabilityRevision;
    return isSuitabilityFilterReady(includeNonStandard);
  }, [includeNonStandard, suitabilityRevision]);

  const profileFeaturesPending =
    profileFeaturesForSection(profileFilters, section).length > 0 && !detailsProducts;
  const ratesReady = filterReady && !profileFeaturesPending;

  useEffect(() => {
    filterPrepAttempts.current = 0;
    setFilterPrepFailed(false);
  }, [coreRevision]);

  useEffect(() => {
    if (!coreRevision || refreshing || (!warmDetails && !profileFeaturesPending)) return;
    let cancelled = false;
    let interaction: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
    // Details are optional and expensive. Warm them after first paint only for
    // preferences or notification filters that genuinely need product detail;
    // the default home path remains core-only after a new ingest.
    const timer = setTimeout(() => {
      interaction = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) void ensureDetails();
      });
    }, profileFeaturesPending ? 0 : 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      interaction?.cancel();
    };
  }, [coreRevision, refreshing, warmDetails, profileFeaturesPending, ensureDetails]);

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
  const profileCount = profileSectionCount(profileFilters, section);
  const best = useMemo(
    () => {
      void suitabilityRevision;
      return bestRow(
        profileFilterRows(hierRows, profileFilters, section, detailsProducts),
        section,
        includeNonStandard,
        depositRankMetric,
        detailsProducts,
        mortgageRateMetric,
      );
    },
    [hierRows, profileFilters, section, includeNonStandard, depositRankMetric, mortgageRateMetric, detailsProducts, suitabilityRevision],
  );
  const fallbackBest = useMemo(
    () => {
      void suitabilityRevision;
      return bestRow(
        profileFilterRows(sectionRows ?? [], profileFilters, section, detailsProducts),
        section,
        includeNonStandard,
        depositRankMetric,
        detailsProducts,
        mortgageRateMetric,
      );
    },
    [sectionRows, profileFilters, section, includeNonStandard, depositRankMetric, mortgageRateMetric, detailsProducts, suitabilityRevision],
  );

  const meta = SECTIONS[section];
  const activeBest = ratesReady ? best ?? fallbackBest : null;
  // Show the ranked best product's own rate (base ongoing by default) so the
  // headline can't overstate what the winner actually pays; with a profile active,
  // show nothing (not the market extreme) when nothing matches.
  const heroBest = activeBest ? rankFraction(activeBest, section, depositRankMetric, mortgageRateMetric) : null;
  const heroRate = !ratesReady
    ? null
    : profileCount > 0
      ? heroBest
      : heroBest ?? (meta.lowerIsBetter ? stats.min : stats.max);
  const scenarioSummary = useMemo(() => {
    const mortgage = computeLvr(userScenario.mortgage);
    if (section === 'Mortgage') {
      return {
        currentRate: toFraction(userScenario.mortgage.currentRate),
        principal: mortgage.loan ?? num(userScenario.mortgage.loanBalance),
      };
    }
    const deposit = section === 'Savings' ? userScenario.savings : userScenario.termDeposit;
    return { currentRate: toFraction(deposit.currentRate), principal: num(deposit.balance) };
  }, [section, userScenario]);
  const loyaltyGap = useMemo(
    () =>
      heroRate != null && scenarioSummary.currentRate != null
        ? loyaltyGapInsight(
            section,
            scenarioSummary.principal,
            scenarioSummary.currentRate,
            heroRate,
            stats.median,
          )
        : null,
    [heroRate, scenarioSummary, section, stats.median],
  );
  const shareMessage = useMemo(() => {
    if (!core) return null;
    if (heroRate == null) return null; // nothing worth sharing until rates are loaded
    return [
      `Best ${meta.title.toLowerCase()} rate today: ${formatRate(heroRate)} (${formatRunDate(core.run_date)})`,
      `Tracked daily across ${Object.keys(core.brands ?? {}).length} Australian lenders.`,
      `Get the AustralianRates app: https://github.com/${REPO}/releases/tag/${APK_RELEASE_TAG}`,
    ].join('\n');
  }, [core, meta, heroRate]);
  const shareToday = useCallback(() => setShareOpen(true), []);

  if (!core) return null;
  const sectionAccent = meta.accentColor;
  const rateInk = meta.lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit;
  const bestNote = conditionalNote(activeBest, section);
  const heroDataKey = `${core.run_date}:${section}:${ratesReady ? heroRate ?? 'na' : 'warming'}`;

  return (
    <ScreenScrollView
      ref={scrollRef}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
      }
    >
      <HomeHero
        dataKey={core.run_date}
        runDateLabel={formatRunDate(core.run_date)}
        runAgeLabel={relativeDate(`${core.run_date}T00:00:00Z`)}
        source={source}
        offline={offline}
        pendingIngest={!!pendingIngestRunDate && !offline}
        onShare={shareToday}
        coverageLabel={`${Object.keys(core.brands ?? {}).length} brands · ${Object.values(core.sections).reduce((sum, value) => sum + (value.ribbon?.counts?.products ?? 0), 0)} products · ${Object.values(core.sections).reduce((sum, value) => sum + (value.rates?.length ?? 0), 0)} published rates${core.coverage?.failures?.length ? ` · ${core.coverage.failures.length} provider failures` : ''}`}
      />

      <Card style={{ borderColor: `${meta.accentColor}55`, gap: theme.spacing(2) }}>
        <AppText variant="tiny" color="textFaint" weight="700">
          MY LOYALTY GAP
        </AppText>
        {loyaltyGap && scenarioSummary.currentRate != null ? (
          <>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <AppText variant="small" color="textMuted">My saved rate</AppText>
                <AppText variant="h3">{formatRate(scenarioSummary.currentRate)}</AppText>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <AppText variant="small" color="textMuted">Matched observed best</AppText>
                <AppText variant="h3" style={{ color: meta.lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit }}>
                  {formatRate(heroRate)}
                </AppText>
              </View>
            </Row>
            <AppText variant="body" weight="700">
              {loyaltyGap.gapRate > 0
                ? section === 'TD'
                  ? `Illustrative annualised gap: $${Math.round(loyaltyGap.annualDollars).toLocaleString()} across a full year; actual interest depends on term and maturity.`
                  : `Illustrative gap: $${Math.round(loyaltyGap.monthlyDollars).toLocaleString()}/month · $${Math.round(loyaltyGap.annualDollars).toLocaleString()}/year`
                : 'Your saved rate is at least as strong as this matched observed rate.'}
            </AppText>
            <AppText variant="tiny" color="textMuted">
              Based on ${Math.round(scenarioSummary.principal).toLocaleString()} and the selected profile. Excludes fees, tax, switching costs and future rate changes; not financial advice.
            </AppText>
            {activeBest ? (
              <Button
                title="View supporting rate"
                variant="secondary"
                onPress={() => openProduct(activeBest.product_key, activeBest.rate_index)}
              />
            ) : null}
          </>
        ) : (
          <>
            <AppText variant="body" color="textMuted">
              Add your current rate and balance to compare your situation with profile-matched observed rates.
            </AppText>
            <Button title="Add my rate" variant="secondary" onPress={() => router.push('/calculator')} />
          </>
        )}
      </Card>

      {sectionOptions.length > 1 ? (
        <SegmentedControl options={sectionOptions} value={section} onChange={setActiveSection} />
      ) : null}

      <SectionCrossfade section={section}>
      <Card style={{ borderColor: `${sectionAccent}44` }}>
        {!ratesReady ? (
          <View style={{ gap: theme.spacing(3) }}>
            <View>
              <AppText variant="tiny" color="textFaint" weight="700">
                BEST IN {meta.title.toUpperCase()}
              </AppText>
              <AppText variant="small" color="textMuted" style={{ marginTop: theme.spacing(1) / 2 }}>
                {filterPrepFailed
                  ? 'Could not prepare filtered rates for today.'
                  : profileFeaturesPending
                    ? 'Preparing rates that match your profile features…'
                    : 'Preparing filtered rates for today…'}
              </AppText>
            </View>
            {filterPrepFailed ? (
              <Button title="Retry" variant="secondary" onPress={retryFilterPrep} />
            ) : (
              <>
                <IndeterminateProgressBar
                  caption="Waiting until the new daily ingest is ready for your filter settings."
                  accessibilityLabel="Preparing filtered rates"
                />
                <LoadingRows count={1} />
              </>
            )}
          </View>
        ) : (
          <>
            <SpringOnNewData dataKey={heroDataKey}>
              <Row
                style={{
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: activeBest ? theme.spacing(3) : 0,
                }}
              >
                <View style={{ flex: 1, paddingRight: theme.spacing(3) }}>
                  <AppText variant="tiny" color="textFaint" weight="700">
                    BEST IN {meta.title.toUpperCase()}
                  </AppText>
                  <AppText variant="small" color="textMuted" style={{ marginTop: theme.spacing(1) / 2 }}>
                    {meta.lowerIsBetter ? 'Lowest' : 'Top'} rate today
                    {profileCount > 0 ? ' · matches your profile' : ''}
                  </AppText>
                  <AppText variant="rateHero" style={{ color: rateInk, marginTop: theme.spacing(1) }}>
                    {formatRate(heroRate)}
                  </AppText>
                  {bestNote ? (
                    <AppText
                      variant="tiny"
                      weight="700"
                      style={{ color: theme.colors.warning, marginTop: theme.spacing(1) }}
                    >
                      {bestNote}
                    </AppText>
                  ) : null}
                </View>
              </Row>
            </SpringOnNewData>
            {activeBest ? (
              <Pressable
                onLongPress={() => openBank(activeBest.provider)}
                delayLongPress={450}
                accessibilityHint="Long press to open lender profile"
              >
                <ProductCard
                  row={activeBest}
                  section={section}
                  onPress={() => openProduct(activeBest.product_key, activeBest.rate_index)}
                />
              </Pressable>
            ) : null}
          </>
        )}
      </Card>
      </SectionCrossfade>

      <ShareQrModal visible={shareOpen} onClose={() => setShareOpen(false)} shareMessage={shareMessage} />
    </ScreenScrollView>
  );
}
