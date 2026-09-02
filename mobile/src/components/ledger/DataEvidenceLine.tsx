import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import type { DisplayEvidence } from '../../data/displayEvidence';
import type { LedgerPalette } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeProvider';
import { LedgerIcon, type LedgerIconName } from '../icons/LedgerIcon';
import { LedgerRow } from './LedgerRow';
import { LedgerSheet } from './LedgerSheet';
import { LedgerText } from './LedgerText';

const ICONS: Record<DisplayEvidence['kind'], LedgerIconName> = {
  current: 'success',
  partial: 'warning',
  saved: 'receipt',
  overdue: 'alert',
  sample: 'info',
  offline: 'offline',
  unavailable: 'alert',
  loading: 'refresh',
};

const TONES: Record<DisplayEvidence['tone'], keyof LedgerPalette> = {
  positive: 'eucalyptus',
  caution: 'clay',
  neutral: 'mutedInk',
  danger: 'danger',
};

export function DataEvidenceLine({
  evidence,
  onPress,
  detailsTitle = 'Data details',
}: {
  evidence: DisplayEvidence;
  onPress?: () => void;
  detailsTitle?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const tone = TONES[evidence.tone];

  const openDetails = () => {
    if (onPress) onPress();
    else setOpen(true);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${evidence.label}. ${evidence.detail} Open data details.`}
        onPress={openDetails}
        style={({ pressed }) => ({
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 8,
          opacity: pressed ? 0.62 : 1,
        })}
      >
        <LedgerIcon name={ICONS[evidence.kind]} size={18} color={theme.ledger[tone]} />
        <View style={{ flex: 1 }}>
          <LedgerText variant="caption" tone={tone}>{evidence.label}</LedgerText>
          <LedgerText variant="caption" tone="mutedInk" numberOfLines={2}>
            {evidence.detail}
          </LedgerText>
        </View>
        <LedgerIcon name="chevron-right" size={16} color={theme.ledger.mutedInk} />
      </Pressable>

      {!onPress ? (
        <LedgerSheet visible={open} title={detailsTitle} onClose={() => setOpen(false)}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <LedgerText tone="mutedInk" style={{ marginBottom: 12 }}>{evidence.detail}</LedgerText>
            {evidence.facts.map((fact, index) => (
              <LedgerRow
                key={`${fact}-${index}`}
                title={fact}
                separator={index < evidence.facts.length - 1}
              />
            ))}
          </ScrollView>
        </LedgerSheet>
      ) : null}
    </>
  );
}
