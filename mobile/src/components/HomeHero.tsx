import React, { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useReducedMotion } from '../hooks/useReducedMotion';
import type { PayloadCoverage, PayloadSource } from '../types';
import type { AssetState } from '../data/assetState';
import { mapDisplayEvidence } from '../data/displayEvidence';
import { useTheme } from '../theme/ThemeProvider';
import { LedgerIcon } from './icons/LedgerIcon';
import { LedgerRow, LedgerSheet, LedgerText } from './ledger';

const DATA_CHANGE_TIMING = { duration: 160, easing: Easing.bezier(0.2, 0, 0, 1) };

/** Restrained scale cue for hero stats when `dataKey` changes. */
export function SpringOnNewData({
  dataKey,
  children,
}: {
  dataKey: string;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion !== false) {
      scale.value = 1;
      return;
    }
    scale.value = 0.98;
    scale.value = withTiming(1, DATA_CHANGE_TIMING);
  }, [dataKey, reducedMotion, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export function HomeHero({
  runDateLabel,
  runDate,
  runAgeLabel,
  source,
  offline,
  onShare,
  pendingIngest = false,
  coverageLabel,
  coverage,
  assetStatus,
  assetReason,
  overdueAfterUtc,
  scheduleLabel,
}: {
  runDateLabel: string;
  runDate: string;
  runAgeLabel: string;
  source: PayloadSource;
  offline: boolean;
  /** Identifies the installed payload. */
  dataKey: string;
  /** Shares today's headline rates (system share sheet). */
  onShare?: () => void;
  /** Rolling ingest for today is still uploading on GitHub. */
  pendingIngest?: boolean;
  /** Measured payload coverage; never implies whole-market completeness. */
  coverageLabel: string;
  coverage?: PayloadCoverage | null;
  assetStatus?: AssetState<unknown>['status'];
  assetReason?: string | null;
  overdueAfterUtc?: string | null;
  scheduleLabel?: string | null;
}) {
  const theme = useTheme();
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidence = mapDisplayEvidence({
    source,
    offline,
    runDate: coverage?.observed_on ?? coverage?.observed_at ?? runDate,
    coverage,
    assetStatus: pendingIngest && assetStatus === 'live' ? 'loading' : assetStatus,
    assetReason,
    hasUsableData: true,
    overdueAfterUtc,
    scheduleLabel,
  });
  const evidenceTone = evidence.tone === 'danger'
    ? 'danger'
    : evidence.tone === 'caution'
      ? 'clay'
      : 'mutedInk';

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable
          onPress={() => setEvidenceOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`${runDateLabel}. ${evidence.label}. ${evidence.detail} Open data details.`}
          style={({ pressed }) => ({
            flex: 1,
            minHeight: 48,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            opacity: pressed ? 0.62 : 1,
          })}
        >
          <LedgerText variant="caption" tone={evidenceTone} style={{ flex: 1 }}>
            {runDateLabel} · {evidence.label}
          </LedgerText>
          <LedgerIcon name="info" size={16} color={theme.ledger[evidenceTone]} />
        </Pressable>
        {onShare ? (
          <Pressable
            onPress={onShare}
            accessibilityRole="button"
            accessibilityLabel="Share observed rates"
            style={({ pressed }) => ({
              minWidth: 48,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.62 : 1,
            })}
          >
            <LedgerIcon name="share" size={19} color={theme.ledger.mutedInk} />
          </Pressable>
        ) : null}
      </View>
      <LedgerSheet visible={evidenceOpen} title="Today’s data" onClose={() => setEvidenceOpen(false)}>
        <ScrollView contentContainerStyle={{ paddingBottom: 24, gap: 12 }}>
          <LedgerText tone={evidenceTone}>{evidence.label}</LedgerText>
          <LedgerText tone="mutedInk">{evidence.detail}</LedgerText>
          <LedgerText variant="caption" tone="mutedInk">{runDateLabel} · {runAgeLabel}</LedgerText>
          <LedgerText variant="caption" tone="mutedInk">
            {source === 'sample' ? 'Sample data · not today’s market' : coverageLabel}
          </LedgerText>
          <View>
            {evidence.facts.map((fact, index) => (
              <LedgerRow key={`${fact}-${index}`} title={fact} separator={index < evidence.facts.length - 1} />
            ))}
          </View>
        </ScrollView>
      </LedgerSheet>
    </>
  );
}
