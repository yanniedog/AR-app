import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BankAvatar } from '../src/components/BankAvatar';
import { Chip } from '../src/components/ui';
import { AppText, Button, Card, Row } from '../src/components/ui';
import { SECTIONS, SECTION_ORDER } from '../src/constants';
import { DEFAULT_INTERESTS, toggleInterest } from '../src/data/interests';
import { formatRankedFraction, formatRate } from '../src/data/format';
import { resolveSectionRibbonStats } from '../src/data/ribbonStats';
import { bestRow, rankFraction } from '../src/data/selectors';
import { useStore } from '../src/data/store';
import { rowsUnder } from '../src/data/taxonomy';
import { ensurePermissions } from '../src/data/notifications';
import type { RateRow, SectionKey } from '../src/types';
import { useTheme } from '../src/theme/ThemeProvider';
import { useSuitabilityRevision } from '../src/hooks/useSuitabilityRevision';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useLogoReadiness } from '../src/hooks/useLogoReadiness';
import { ScreenSkeleton } from '../src/components/feedback';

type OnboardingStep = 1 | 2;

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

function NotificationPreview({
  section,
  best,
}: {
  section: SectionKey;
  best: RateRow | null;
}) {
  const theme = useTheme();
  const meta = SECTIONS[section];
  const rateLabel = best ? formatRate(best.rate) : '—';
  const lender = best?.provider ?? 'a lender';

  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: 12,
        marginTop: 16,
      }}
    >
      <AppText variant="tiny" color="textFaint" weight="700" style={{ marginBottom: 8, letterSpacing: 0.6 }}>
        PREVIEW
      </AppText>
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="trending-up" size={20} color={theme.colors.onPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="small" weight="700">
            Australian Rates
          </AppText>
          <AppText variant="tiny" color="textMuted">
            now
          </AppText>
          <AppText variant="body" style={{ marginTop: 4 }}>
            Best {meta.short.toLowerCase()} rate is {rateLabel} at {lender}
          </AppText>
        </View>
      </Row>
    </View>
  );
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
  const [step, setStep] = useState<OnboardingStep>(1);
  const [interests, setInterests] = useState<SectionKey[]>([...DEFAULT_INTERESTS]);
  const [notify, setNotify] = useState(false);
  const [laidOutStep, setLaidOutStep] = useState<OnboardingStep | null>(null);
  const [notificationPreviewReady, setNotificationPreviewReady] = useState(false);

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
  const showNotificationStep = useCallback(() => setStep(2), []);
  const goBack = useCallback(() => {
    setStep((current) => Math.max(1, current - 1) as OnboardingStep);
  }, []);
  const toggleNotifications = useCallback(() => {
    setNotify((value) => !value);
    setNotificationPreviewReady(false);
  }, []);
  const auditActions = useMemo(() => ({
    'onboarding.open': () => undefined,
    'onboarding.section.toggle': () => {
      const next = SECTION_ORDER.find((key) => !interests.includes(key))
        ?? SECTION_ORDER.find((key) => key !== section);
      if (next) toggle(next);
    },
    'onboarding.step.next': showNotificationStep,
    'onboarding.notify.preview': () => {
      showNotificationStep();
      if (!notify) toggleNotifications();
    },
    'onboarding.step.back': goBack,
  }), [
    goBack,
    interests,
    notify,
    section,
    showNotificationStep,
    toggle,
    toggleNotifications,
  ]);
  const needsSnapshotLogo = step === 1 && snapshot?.best != null;
  const needsNotificationGraphic = step === 2 && notify;
  const onboardingLogoIds = useMemo(
    () => needsSnapshotLogo ? ['onboarding-best'] : [],
    [needsSnapshotLogo],
  );
  const onboardingLogos = useLogoReadiness(
    `${snapshot?.runDate ?? 'none'}:${step}:${snapshot?.best?.product_key ?? 'none'}`,
    onboardingLogoIds,
  );
  usePerformanceAuditSurface({
    id: 'onboarding.step',
    routeKey: '/onboarding',
    datasetRevision: snapshot?.runDate ?? null,
    renderRevision: JSON.stringify([
      snapshot?.runDate ?? 'none',
      step,
      section,
      notify ? 'notify' : 'quiet',
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
        id: 'onboarding.notification-preview',
        kind: 'graphic',
        required: needsNotificationGraphic,
        status: !needsNotificationGraphic || notificationPreviewReady ? 'ready' : 'pending',
        expectedCount: needsNotificationGraphic ? 1 : 0,
        actualCount: needsNotificationGraphic && notificationPreviewReady ? 1 : 0,
      },
      {
        id: 'onboarding.layout',
        kind: 'layout',
        status: laidOutStep === step ? 'ready' : 'pending',
      },
    ],
  });

  const start = async () => {
    if (notify) {
      const ok = await ensurePermissions();
      completeOnboarding(interests, ok);
    } else {
      completeOnboarding(interests, false);
    }
    router.replace('/(tabs)');
  };

  if (!core) return <ScreenSkeleton />;

  const comparison = snapshot
    ? snapshotComparison(section, snapshot.stats, snapshot.rba)
    : null;

  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top + 24,
        paddingHorizontal: 24,
        backgroundColor: theme.colors.bg,
      }}
    >
      <Row style={{ justifyContent: 'space-between', marginBottom: 20 }}>
        <AppText variant="tiny" color="textFaint" weight="700">
          {step} / 2
        </AppText>
        {step > 1 ? (
          <Pressable onPress={goBack} hitSlop={8}>
            <AppText variant="small" color="primary" weight="600">
              Back
            </AppText>
          </Pressable>
        ) : null}
      </Row>

      {step === 1 ? (
        <View key="onboarding-1" style={{ flex: 1 }} onLayout={() => setLaidOutStep(1)}>
          <AppText variant="h1">See your market</AppText>
          <AppText variant="body" color="textMuted" style={{ marginTop: 8, lineHeight: 22 }}>
            Pick what you track — we&apos;ll show today&apos;s best rate from live Australian data.
          </AppText>

          <AppText variant="h3" style={{ marginTop: 28, marginBottom: 12 }}>
            What are you interested in?
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

          <Card
            style={{
              marginTop: 24,
              borderColor: `${accent}44`,
            }}
          >
            <AppText variant="tiny" color="textFaint" weight="700">
              {meta.title.toUpperCase()}
            </AppText>
            <AppText variant="small" color="textMuted" style={{ marginTop: 2 }}>
              Best rate today · {snapshot?.runDate ?? '—'}
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
                  <AppText variant="body" weight="700">
                    {snapshot.best.provider}
                  </AppText>
                  <AppText variant="tiny" color="textMuted">
                    {formatRate(snapshot.best.rate)}
                    {snapshot.best.comparison_rate
                      ? ` · cmp ${formatRate(snapshot.best.comparison_rate)}`
                      : ''}
                  </AppText>
                </View>
              </Row>
            ) : null}
            {snapshot ? (
              <AppText variant="small" color="textMuted" style={{ marginTop: 10 }}>
                {comparison ? `vs ${comparison}` : 'Updated daily from CDR data'}
              </AppText>
            ) : null}
          </Card>

          <View style={{ flex: 1 }} />
          <Button
            title="Continue"
            icon="arrow-forward"
            onPress={showNotificationStep}
            style={{ marginBottom: insets.bottom + 20 }}
          />
        </View>
      ) : (
        <View key="onboarding-2" style={{ flex: 1 }} onLayout={() => setLaidOutStep(2)}>
          <AppText variant="h1">Stay ahead of moves</AppText>
          <AppText variant="body" color="textMuted" style={{ marginTop: 8, lineHeight: 22 }}>
            Get a local alert when the best {meta.short.toLowerCase()} rate changes or the RBA
            updates — only if you want it.
          </AppText>

          <Row gap={12} style={{ marginTop: 28, alignItems: 'flex-start' }}>
            <Ionicons name="notifications-outline" size={22} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="body" weight="700">
                Notify me when this rate moves
              </AppText>
              <AppText variant="small" color="textMuted" style={{ marginTop: 2 }}>
                Best-rate, RBA, and watchlist alerts — local only, no account.
              </AppText>
            </View>
            <Chip label={notify ? 'On' : 'Off'} selected={notify} onPress={toggleNotifications} />
          </Row>

          {notify ? (
            <View onLayout={() => setNotificationPreviewReady(true)}>
              <NotificationPreview section={section} best={snapshot?.best ?? null} />
            </View>
          ) : null}

          <View style={{ flex: 1 }} />
          <Button
            title={notify ? 'Enable alerts & start' : 'Start without alerts'}
            icon="arrow-forward"
            onPress={start}
            style={{ marginBottom: insets.bottom + 20 }}
          />
        </View>
      )}
    </View>
  );
}
