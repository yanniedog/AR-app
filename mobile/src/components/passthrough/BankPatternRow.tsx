import Ionicons from '../icons/AppIcon';
import React, { memo } from 'react';
import { Pressable, View } from 'react-native';

import type { BankResponseProfile } from '../../data/passThroughModels';
import { openBank } from '../../lib/nav';
import { useTheme } from '../../theme/ThemeProvider';
import { BankAvatar } from '../BankAvatar';
import { AppText, Badge, Row } from '../ui';
import { uiCount, uiJoin, uiLabel, uiProviderName, type UiText } from '../../lib/uiCopy';
import { uiChartBps, uiChartPercent, uiResponseDays } from '../../lib/chartUiCopy';

function patternEvidence(profile: BankResponseProfile): UiText {
  return uiLabel(profile.confidence === 'established' ? 'Established' : profile.confidence === 'developing' ? 'Developing' : profile.confidence === 'early' ? 'Limited' : 'Pending');
}

function currentLabel(profile: BankResponseProfile): UiText | null {
  if (!profile.currentWindowIncluded || !profile.currentStatus) return null;
  if (profile.currentStatus === 'waiting') return uiJoin('Response window', ' · ', 'No observed move');
  return uiJoin('Response window', ' · ', uiChartBps(profile.currentBps), ' · ', uiResponseDays(profile.currentDays));
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
      accessibilityLabel={uiJoin(uiProviderName(profile), ' · ', profile.direction === 'hike' ? 'Hike' : 'Cut', ' · ', 'Complete windows', ' ', uiCount(profile.movedWithRba), '/', uiCount(profile.windowsObserved), ' · ', 'Median response', ' ', uiResponseDays(profile.medianDays), current ? uiJoin(' · ', current) : null)}
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
          <AppText variant="small" weight="700" numberOfLines={1}>{uiProviderName(profile)}</AppText>
          <AppText variant="tiny" color="textMuted" style={{ marginTop: 2 }}>
            {uiJoin('Complete windows', ' · ', uiCount(profile.movedWithRba), '/', uiCount(profile.windowsObserved))}
          </AppText>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <AppText variant="rate">{uiChartPercent(profile.responseRatePct, 0)}</AppText>
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
        {profile.medianDays != null ? <Badge label={uiJoin('Median response', ' · ', uiResponseDays(profile.medianDays))} tone="muted" /> : null}
        {profile.medianPassPct != null ? <Badge label={uiJoin('Median', ' · ', uiChartPercent(Math.round(profile.medianPassPct), 0))} tone="muted" /> : null}
        {current ? <Badge label={current} tone="primary" /> : null}
      </Row>
    </Pressable>
  );
});
