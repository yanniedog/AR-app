import { useScrollToTop } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { InteractionManager, Pressable, RefreshControl, ScrollView, View } from 'react-native';

import { HomeHero, SpringOnNewData } from '../../src/components/HomeHero';
import { ProductCard } from '../../src/components/ProductCard';
import { IndeterminateProgressBar, LoadingRows } from '../../src/components/feedback';
import { ScreenScrollView } from '../../src/components/Screen';
import { SectionCrossfade, SegmentedControl } from '../../src/components/controls';
import { AppText, Card, Row } from '../../src/components/ui';
import { SECTIONS } from '../../src/constants';
import { formatRate, formatRunDate, relativeDate } from '../../src/data/format';
import { resolveInterestSection, sectionSegmentOptions } from '../../src/data/interests';
import { resolveSectionRibbonStats } from '../../src/data/ribbonStats';
import { profileFilterRows, profileSectionCount } from '../../src/data/profile';
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

export default function Home() {
  const theme = useTheme();
  const core = useStore((s) => s.core);
  const coreSha = useStore((s) => s.manifest?.files.core.sha256 ?? '');
  const refreshing = useStore((s) => s.refreshing);
  const refresh = useStore((s) => s.refresh);
  const ensureDetails = useStore((s) => s.ensureDetails);
  const source = useStore((s) => s.source);
  const offline = useStore((s) => s.offline);
  const interests = useStore((s) => s.prefs.interests);
  const section = useStore((s) => s.activeSection);
  const setActiveSection = useStore((s) => s.setActiveSection);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const profileFilters = useStore((s) => s.prefs.profileFilters);
  const warmDetails = useStore((s) => shouldWarmDetails(s.prefs, s.subscriptions));
  const detailsProducts = useStore((s) => s.details?.products ?? null);
  const suitabilityRevision = useSuitabilityRevision();
  const sectionOptions = useMemo(() => sectionSegmentOptions(interests), [interests]);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    const resolved = resolveInterestSection(interests, section);
    if (resolved !== section) setActiveSection(resolved);
  }, [interests, section, setActiveSection]);

  const coreRevision = core ? `${core.run_date}:${coreSha}` : '';
  const filterReady = useMemo(() => {
    void suitabilityRevision;
    return isSuitabilityFilterReady(includeNonStandard);
  }, [includeNonStandard, suitabilityRevision]);

  useEffect(() => {
    if (!coreRevision || refreshing || !warmDetails) return;
    let cancelled = false;
    let interaction: ReturnType<typeof InteractionManager.runAfterInteractions> | null = null;
    // Details are optional and expensive. Warm them after first paint only for
    // preferences or notification filters that genuinely need product detail;
    // the default home path remains core-only after a new ingest.
    const timer = setTimeout(() => {
      interaction = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) void ensureDetails();
      });
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      interaction?.cancel();
    };
  }, [coreRevision, refreshing, warmDetails, ensureDetails]);

  // Standard-only Home needs the details-derived suitability index. Refresh /
  // bootstrap already force-rebuild, but kick ensureDetails here too so the
  // wait UI cannot stall if that post-work has not claimed the load yet.
  useEffect(() => {
    if (!coreRevision || refreshing || includeNonStandard || filterReady) return;
    void ensureDetails({ force: true });
  }, [coreRevision, refreshing, includeNonStandard, filterReady, ensureDetails]);

  const onRefresh = useCallback(() => void refresh({ manual: true }), [refresh]);
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);

  const sectionRows = core?.sections[section]?.rates;
  const sectionData = core?.sections[section];
  const hierRows = useMemo(() => rowsUnder(sectionRows ?? [], section, []), [sectionRows, section]);
  const stats = useMemo(
    () => {
      void suitabilityRevision;
      return resolveSectionRibbonStats(sectionData, hierRows, includeNonStandard, section, detailsProducts);
    },
    [sectionData, hierRows, includeNonStandard, section, detailsProducts, suitabilityRevision],
  );
  // The hero "best" honours the saved product profile (e.g. OO, P&I, your LVR).
  const profileCount = profileSectionCount(profileFilters, section);
  const best = useMemo(
    () => {
      void suitabilityRevision;
      return bestRow(
        profileFilterRows(hierRows, profileFilters, section),
        section,
        includeNonStandard,
        depositRankMetric,
        detailsProducts,
      );
    },
    [hierRows, profileFilters, section, includeNonStandard, depositRankMetric, detailsProducts, suitabilityRevision],
  );
  const fallbackBest = useMemo(
    () => {
      void suitabilityRevision;
      return bestRow(
        profileFilterRows(sectionRows ?? [], profileFilters, section),
        section,
        includeNonStandard,
        depositRankMetric,
        detailsProducts,
      );
    },
    [sectionRows, profileFilters, section, includeNonStandard, depositRankMetric, detailsProducts, suitabilityRevision],
  );

  const meta = SECTIONS[section];
  const shareMessage = useMemo(() => {
    if (!core) return null;
    const headline = meta.lowerIsBetter ? stats.min : stats.max;
    if (headline == null) return null; // nothing worth sharing until rates are loaded
    return [
      `Best ${meta.title.toLowerCase()} rate today: ${formatRate(headline)} (${formatRunDate(core.run_date)})`,
      `Tracked daily across ${Object.keys(core.brands ?? {}).length} Australian lenders.`,
      `Get the AustralianRates app: https://github.com/${REPO}/releases/tag/${APK_RELEASE_TAG}`,
    ].join('\n');
  }, [core, meta, stats]);
  const shareToday = useCallback(() => setShareOpen(true), []);

  if (!core) return null;
  const sectionAccent = meta.accentColor;
  const rateInk = meta.lowerIsBetter ? theme.colors.rateLoan : theme.colors.rateDeposit;
  const activeBest = filterReady ? best ?? fallbackBest : null;
  // Show the ranked best product's own rate (base ongoing by default) so the
  // headline can't overstate what the winner actually pays; with a profile active,
  // show nothing (not the market extreme) when nothing matches.
  const heroBest = activeBest ? rankFraction(activeBest, section, depositRankMetric) : null;
  const heroRate = !filterReady
    ? null
    : profileCount > 0
      ? heroBest
      : heroBest ?? (meta.lowerIsBetter ? stats.min : stats.max);
  const bestNote = conditionalNote(activeBest, section);
  const heroDataKey = `${core.run_date}:${section}:${filterReady ? heroRate ?? 'na' : 'warming'}`;

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
        onShare={shareToday}
      />

      {sectionOptions.length > 1 ? (
        <SegmentedControl options={sectionOptions} value={section} onChange={setActiveSection} />
      ) : null}

      <SectionCrossfade section={section}>
      <Card style={{ borderColor: `${sectionAccent}44` }}>
        {!filterReady ? (
          <View style={{ gap: theme.spacing(3) }}>
            <View>
              <AppText variant="tiny" color="textFaint" weight="700">
                BEST IN {meta.title.toUpperCase()}
              </AppText>
              <AppText variant="small" color="textMuted" style={{ marginTop: theme.spacing(1) / 2 }}>
                Preparing filtered rates for today…
              </AppText>
            </View>
            <IndeterminateProgressBar
              caption="Waiting until the new daily ingest is ready for your filter settings."
              accessibilityLabel="Preparing filtered rates"
            />
            <LoadingRows count={1} />
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
