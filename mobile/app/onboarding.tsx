import Ionicons from '../src/components/icons/AppIcon';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BankAvatar } from '../src/components/BankAvatar';
import { BrandLockup } from '../src/components/BrandLockup';
import { OptionCard } from '../src/components/OptionCard';
import { Chip } from '../src/components/ui';
import { AppText, Button, Card, Row } from '../src/components/ui';
import { SECTIONS, SECTION_ORDER } from '../src/constants';
import { toggleInterest } from '../src/data/interests';
import { formatRankedFraction, formatRate, formatRunDate } from '../src/data/format';
import { resolveSectionRibbonStats } from '../src/data/ribbonStats';
import { bestRow, rankedRateLabelForSection, rankFraction } from '../src/data/selectors';
import { ratePresentation } from '../src/data/ratePresentation';
import { useStore } from '../src/data/store';
import { rowsUnder } from '../src/data/taxonomy';
import type { SectionKey } from '../src/types';
import { useTheme } from '../src/theme/ThemeProvider';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../src/hooks/useLogoReadiness';
import { ScreenSkeleton } from '../src/components/feedback';

type FirstJob = 'check' | 'find' | 'follow';

const JOBS: { value: FirstJob; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'check', label: 'Check a rate I have', description: 'See if your rate is still competitive', icon: 'shield-checkmark-outline' },
  { value: 'find', label: 'Find or plan', description: 'Compare rates and plan a switch', icon: 'search-outline' },
  { value: 'follow', label: 'Follow rate changes', description: 'Track lender and RBA moves', icon: 'notifications-outline' },
];

function primaryInterest(interests: SectionKey[]): SectionKey {
  return interests[0] ?? 'Mortgage';
}

function snapshotComparison(
  section: SectionKey,
  stats: { median: number | null },
  rbaRate: number | undefined,
): string | null {
  if (section === 'Mortgage' && rbaRate != null) {
    return `RBA cash ${rbaRate.toFixed(2)}%`;
  }
  if (stats.median != null) {
    return `Median ${(stats.median * 100).toFixed(2)}%`;
  }
  return null;
}

export default function Onboarding() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const core = useStore((s) => s.core);
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const suitabilityRevision = useSuitabilityRevision();
  const storeStatus = useStore((s) => s.status);
  const storeError = useStore((s) => s.error);
  const hydrated = useStore((s) => s.hydrated);
  const source = useStore((s) => s.source);
  // Preselect every product family so the catalogue is populated by default;
  // the person narrows it here or with the type switch on the Rates screen.
  const [interests, setInterests] = useState<SectionKey[]>(() => [...SECTION_ORDER]);
  const [job, setJob] = useState<FirstJob>('check');
  const [layoutReady, setLayoutReady] = useState(false);

  const section = primaryInterest(interests);
  const meta = SECTIONS[section];
  const accent = meta.lowerIsBetter ? theme.colors.success : theme.colors.primary;

  const snapshot = useMemo(() => {
    void suitabilityRevision;
    if (!core) return null;
    const sectionRows = core.sections[section]?.rates;
    const sectionData = core.sections[section];
    const hierRows = rowsUnder(sectionRows ?? [], section, []);
    const stats = resolveSectionRibbonStats(
      sectionData,
      hierRows,
      false,
      section,
      null,
      depositRankMetric,
      mortgageRateMetric,
    );
    const best = bestRow(hierRows, section, false, depositRankMetric, null, mortgageRateMetric);
    const heroRate = best
      ? rankFraction(best, section, depositRankMetric, mortgageRateMetric)
      : meta.lowerIsBetter
        ? stats.min
        : stats.max;
    const rba = section === 'Mortgage' ? core.rba?.at(-1)?.rate : undefined;
    return { best, heroRate, stats, rba, runDate: core.run_date };
  }, [core, section, meta.lowerIsBetter, depositRankMetric, mortgageRateMetric, suitabilityRevision]);

  const toggle = useCallback(
    (key: SectionKey) => setInterests((prev) => toggleInterest(prev, key)),
    [],
  );
  const auditActions = useMemo(() => ({
    'onboarding.open': () => undefined,
    'onboarding.section.toggle': () => {
      const next = SECTION_ORDER.find((key) => !interests.includes(key))
        ?? SECTION_ORDER.find((key) => key !== section);
      if (next) toggle(next);
    },
    'onboarding.job.find': () => setJob('find'),
    'onboarding.job.follow': () => setJob('follow'),
    'onboarding.job.check': () => setJob('check'),
  }), [
    interests,
    section,
    toggle,
  ]);
  const needsSnapshotLogo = snapshot?.best != null;
  const onboardingLogoIds = useMemo(
    () => needsSnapshotLogo ? ['onboarding-best'] : [],
    [needsSnapshotLogo],
  );
  const onboardingLogos = useLogoReadiness(
    `${snapshot?.runDate ?? 'none'}:${snapshot?.best?.product_key ?? 'none'}`,
    onboardingLogoIds,
  );
  usePerformanceAuditSurface({
    id: 'onboarding.step',
    routeKey: '/onboarding',
    datasetRevision: snapshot?.runDate ?? null,
    renderRevision: JSON.stringify([
      snapshot?.runDate ?? 'none',
      job,
      section,
      interests,
    ]),
    actions: auditActions,
    probes: [
      {
        id: 'onboarding.data',
        kind: 'data',
        status: core
          ? 'ready'
          : storeStatus === 'error'
            ? 'error'
            : 'pending',
        error: !core && storeStatus === 'error' ? storeError ?? 'Core data unavailable' : null,
        datasetRevision: snapshot?.runDate ?? null,
      },
      {
        id: 'onboarding.logo',
        kind: 'logo',
        status: onboardingLogos.ready ? 'ready' : 'pending',
        expectedCount: onboardingLogos.expectedCount,
        actualCount: onboardingLogos.terminalCount,
        fallbackCount: onboardingLogos.fallbackCount,
      },
      {
        id: 'onboarding.local-state',
        kind: 'data',
        status: hydrated ? 'ready' : 'pending',
        expectedCount: 1,
        actualCount: hydrated ? 1 : 0,
      },
      {
        id: 'onboarding.layout',
        kind: 'layout',
        status: layoutReady ? 'ready' : 'pending',
        layoutMeasured: layoutReady,
      },
    ],
  });

  const start = () => {
    completeOnboarding(interests, false);
    router.replace(job === 'check'
      ? { pathname: '/calculator', params: { intent: 'check', section } }
      : job === 'find'
        ? '/(tabs)/browse'
        : '/(tabs)/market');
  };

  if (!core) return <ScreenSkeleton />;

  const comparison = snapshot
    ? snapshotComparison(section, snapshot.stats, snapshot.rba)
    : null;
  const snapshotLabel = source === 'remote'
    ? 'Latest observed rate'
    : source === 'cache'
      ? 'Saved rate'
      : 'Sample rate';
  const snapshotRateLabel = rankedRateLabelForSection(
    section,
    depositRankMetric,
    mortgageRateMetric,
  );
  const bestRatePresentation = snapshot?.best
    ? ratePresentation(snapshot.best, section, mortgageRateMetric)
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
          paddingBottom: 24,
        }}
        onContentSizeChange={() => setLayoutReady(true)}
        showsVerticalScrollIndicator
      >
        <BrandLockup markSize={34} style={{ marginBottom: 20 }} />
        <AppText variant="h1">Choose what you want to do</AppText>
        <AppText variant="body" color="textMuted" style={{ marginTop: 8 }}>
          No account needed. Compare Australian rates and keep them on this device.
        </AppText>

        <View style={{ gap: 10, marginTop: 24 }}>
          {JOBS.map((item) => (
            <OptionCard
              key={item.value}
              label={item.label}
              description={item.description}
              icon={item.icon}
              selected={job === item.value}
              onPress={() => setJob(item.value)}
            />
          ))}
        </View>

        <AppText variant="small" weight="700" style={{ marginTop: 24, marginBottom: 10 }}>
          Rates to include
        </AppText>
        <Row gap={10} style={{ flexWrap: 'wrap' }}>
          {SECTION_ORDER.map((key) => (
            <Chip
              key={key}
              label={SECTIONS[key].title}
              icon={SECTIONS[key].icon as keyof typeof Ionicons.glyphMap}
              selected={interests.includes(key)}
              onPress={() => toggle(key)}
            />
          ))}
        </Row>

        <Card style={{ marginTop: 24, borderColor: `${accent}44` }}>
          <AppText variant="tiny" color="textFaint" weight="700">
            {meta.title.toUpperCase()}
          </AppText>
          <AppText variant="small" color="textMuted" style={{ marginTop: 2 }}>
            {snapshotLabel} · {snapshotRateLabel} · {formatRunDate(snapshot?.runDate)}
          </AppText>
          <AppText variant="h1" weight="800" style={{ color: accent, marginTop: 6 }}>
            {snapshot?.heroRate != null ? formatRankedFraction(snapshot.heroRate) : '—'}
          </AppText>
          {snapshot?.best ? (
            <Row gap={10} style={{ marginTop: 12, alignItems: 'center' }}>
              <BankAvatar
                provider={snapshot.best.provider}
                size={36}
                renderStateId="onboarding-best"
                onRenderStateChange={onboardingLogos.onLogoRenderStateChange}
              />
              <View style={{ flex: 1 }}>
                <AppText variant="body" weight="700">{snapshot.best.provider}</AppText>
                <AppText variant="tiny" color="textMuted">
                  {bestRatePresentation?.secondary !== null && bestRatePresentation?.secondaryLabel
                    ? `${bestRatePresentation.secondaryLabel} ${formatRate(bestRatePresentation.secondary)}`
                    : snapshot.best.product_name}
                </AppText>
              </View>
            </Row>
          ) : null}
          {snapshot ? (
            <AppText variant="small" color="textMuted" style={{ marginTop: 10 }}>
              {comparison ? `vs ${comparison}` : 'Observed from published CDR data'}
            </AppText>
          ) : null}
        </Card>
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
          borderTopWidth: 1,
          borderTopColor: theme.ledger.rule,
          backgroundColor: theme.ledger.raised,
        }}
      >
        <Button
          title={job === 'check' ? 'Check my rate' : job === 'find' ? 'Find rates' : 'Follow changes'}
          icon="arrow-forward"
          onPress={start}
        />
      </View>
    </View>
  );
}
