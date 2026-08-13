import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BankAvatar } from '../src/components/BankAvatar';
import { Chip } from '../src/components/ui';
import { AppText, Button, Card, Row } from '../src/components/ui';
import { SECTIONS, SECTION_ORDER } from '../src/constants';
import { DEFAULT_INTERESTS, toggleInterest } from '../src/data/interests';
import { formatRankedFraction, formatRate, formatRunDate } from '../src/data/format';
import { resolveSectionRibbonStats } from '../src/data/ribbonStats';
import { bestRow, rankFraction } from '../src/data/selectors';
import { useStore } from '../src/data/store';
import { rowsUnder } from '../src/data/taxonomy';
import type { SectionKey } from '../src/types';
import { useTheme } from '../src/theme/ThemeProvider';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../src/hooks/useLogoReadiness';
import { ScreenSkeleton } from '../src/components/feedback';

type FirstJob = 'check' | 'find' | 'follow';

const JOBS: { value: FirstJob; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'check', label: 'Check a rate I have', icon: 'shield-checkmark-outline' },
  { value: 'find', label: 'Find or plan', icon: 'search-outline' },
  { value: 'follow', label: 'Follow rate changes', icon: 'notifications-outline' },
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
  const [interests, setInterests] = useState<SectionKey[]>([DEFAULT_INTERESTS[0]]);
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
    // Retained as no-op audit aliases for older saved audit plans. Notification
    // permission is now requested only after the user has entered the app.
    'onboarding.step.next': () => undefined,
    'onboarding.notify.preview': () => undefined,
    'onboarding.step.back': () => undefined,
  }), [
    interests,
    section,
    toggle,
  ]);
  const needsSnapshotLogo = job === 'find' && snapshot?.best != null;
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
      },
    ],
  });

  const start = () => {
    completeOnboarding(interests, false);
    router.replace(job === 'check'
      ? { pathname: '/calculator', params: { intent: 'check', section } }
      : job === 'find'
        ? '/(tabs)/browse'
        : '/(tabs)/passthrough');
  };

  if (!core) return <ScreenSkeleton />;

  const comparison = snapshot
    ? snapshotComparison(section, snapshot.stats, snapshot.rba)
    : null;
  const sourceIntro = source === 'remote'
    ? 'Choose what matters. We’ll show the latest observed Australian rates.'
    : source === 'cache'
      ? 'Choose what matters. Start with rates saved on this device, then refresh when you’re online.'
      : 'Choose what matters. Explore sample Australian rates, then refresh for the current market.';
  const snapshotLabel = source === 'remote'
    ? 'Latest observed rate'
    : source === 'cache'
      ? 'Saved rate'
      : 'Sample rate';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + 24,
          paddingHorizontal: 24,
          paddingBottom: Math.max(insets.bottom, 16) + 16,
        }}
        onContentSizeChange={() => setLayoutReady(true)}
        showsVerticalScrollIndicator
      >
        <AppText variant="h1">Choose what you want to do</AppText>
        <AppText variant="body" color="textMuted" style={{ marginTop: 8 }}>
          {sourceIntro}
        </AppText>

        <AppText variant="h3" style={{ marginTop: 28, marginBottom: 12 }}>
          Start here
        </AppText>
        <View style={{ gap: 10 }}>
          {JOBS.map((item) => (
            <Button
              key={item.value}
              title={item.label}
              icon={item.icon}
              variant={job === item.value ? 'primary' : 'secondary'}
              onPress={() => setJob(item.value)}
            />
          ))}
        </View>

        <AppText variant="h3" style={{ marginTop: 24, marginBottom: 12 }}>
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

        {job === 'find' ? <Card style={{ marginTop: 24, borderColor: `${accent}44` }}>
          <AppText variant="tiny" color="textFaint" weight="700">
            {meta.title.toUpperCase()}
          </AppText>
          <AppText variant="small" color="textMuted" style={{ marginTop: 2 }}>
            {snapshotLabel} · {formatRunDate(snapshot?.runDate)}
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
                  {formatRate(snapshot.best.rate)}
                  {snapshot.best.comparison_rate
                    ? ` · comparison ${formatRate(snapshot.best.comparison_rate)}`
                    : ''}
                </AppText>
              </View>
            </Row>
          ) : null}
          {snapshot ? (
            <AppText variant="small" color="textMuted" style={{ marginTop: 10 }}>
              {comparison ? `vs ${comparison}` : 'Observed from published CDR data'}
            </AppText>
          ) : null}
        </Card> : (
          <Card style={{ marginTop: 24, borderColor: `${accent}44`, gap: 6 }}>
            <Row gap={8}>
              <Ionicons
                name={job === 'check' ? 'lock-closed-outline' : 'notifications-outline'}
                size={22}
                color={accent}
              />
              <AppText variant="h3">
                {job === 'check' ? 'Private rate check' : 'Watch exact rates'}
              </AppText>
            </Row>
            <AppText variant="small" color="textMuted" style={{ lineHeight: 20 }}>
              {job === 'check'
                ? 'Enter only a rate and balance. On native devices, amounts stay in encrypted local storage.'
                : 'See lender changes now. Alerts are offered only after you choose an exact rate to watch.'}
            </AppText>
          </Card>
        )}

        <View style={{ flex: 1, minHeight: 28 }} />
        <Button
          title={job === 'check' ? 'Check my rate' : job === 'find' ? 'Explore rates' : 'See recent changes'}
          icon="arrow-forward"
          onPress={start}
        />
      </ScrollView>
    </View>
  );
}
