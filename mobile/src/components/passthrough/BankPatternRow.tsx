import Ionicons from '../icons/AppIcon';
import React, { memo } from 'react';
import { Pressable, View } from 'react-native';

import type { BankResponseProfile } from '../../data/passThroughModels';
import { openBank } from '../../lib/nav';
import { useTheme } from '../../theme/ThemeProvider';
import { BankAvatar } from '../BankAvatar';
import { AppText, Badge, Row } from '../ui';

function patternEvidence(profile: BankResponseProfile): string {
  if (profile.confidence === 'established') return 'Established pattern';
  if (profile.confidence === 'developing') return 'Developing pattern';
  if (profile.confidence === 'early') return 'Limited evidence';
  return 'Building history';
}

function currentLabel(profile: BankResponseProfile): string | null {
  if (!profile.currentWindowIncluded || !profile.currentStatus) return null;
  if (profile.currentStatus === 'waiting') return 'Current · no matching move yet';
  const bps = profile.currentBps ?? 0;
  const timing = profile.currentDays == null ? '' : ` after ${profile.currentDays}d`;
  return `Current · ${bps > 0 ? '+' : bps < 0 ? '−' : ''}${Math.abs(bps)} bp${timing}`;
}

export const BankPatternRow = memo(function BankPatternRow({
  profile,
}: {
  profile: BankResponseProfile;
}) {
  const theme = useTheme();
  const noMatch = profile.windowsObserved - profile.movedWithRba;
  const current = currentLabel(profile);
  return (
    <Pressable
      onPress={() => openBank(profile.provider)}
      accessibilityRole="button"
      accessibilityLabel={[
        `${profile.provider}.`,
        profile.direction === 'hike' ? 'After cash-rate increases.' : 'After cash-rate cuts.',
        profile.windowsObserved
          ? `Moved with the RBA in ${profile.movedWithRba} of ${profile.windowsObserved} complete tracked rate-change windows.`
          : 'General pattern is still building.',
        profile.medianDays == null
          ? 'No typical response time available.'
          : `Typical response ${profile.medianDays} days.`,
        current,
      ].filter(Boolean).join(' ')}
      accessibilityHint="Open this lender's profile."
      style={{
        marginBottom: 10,
        padding: 14,
        borderRadius: theme.radius.lg,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.card,
      }}
    >
      <Row gap={10} style={{ alignItems: 'center' }}>
        <BankAvatar provider={profile.provider} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <AppText variant="small" weight="700" numberOfLines={1}>{profile.provider}</AppText>
          <AppText variant="tiny" color="textMuted" style={{ marginTop: 2 }}>
            {profile.windowsObserved
              ? `${profile.movedWithRba} of ${profile.windowsObserved} complete windows followed`
              : 'Not enough complete windows yet'}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText variant="rate">{profile.responseRatePct == null ? '—' : `${profile.responseRatePct}%`}</AppText>
          <Ionicons name="chevron-forward" size={15} color={theme.colors.textFaint} />
        </View>
      </Row>

      {profile.windowsObserved ? <View
        style={{
          height: 7,
          borderRadius: 4,
          overflow: 'hidden',
          flexDirection: 'row',
          marginTop: 12,
          backgroundColor: theme.colors.surfaceAlt,
        }}
      >
        {profile.movedWithRba ? <View style={{ flex: profile.movedWithRba, backgroundColor: theme.colors.success }} /> : null}
        {noMatch ? <View style={{ flex: noMatch, backgroundColor: theme.colors.border }} /> : null}
      </View> : null}

      <Row gap={6} style={{ marginTop: 10, flexWrap: 'wrap' }}>
        <Badge label={patternEvidence(profile)} tone={profile.confidence === 'one-window' ? 'muted' : 'primary'} />
        {profile.medianDays != null ? <Badge label={`Typical ${profile.medianDays}d`} tone="muted" /> : null}
        {profile.medianPassPct != null ? <Badge label={`Median ${Math.round(profile.medianPassPct)}% pass`} tone="muted" /> : null}
        {current ? <Badge label={current} tone="primary" /> : null}
      </Row>
    </Pressable>
  );
});
