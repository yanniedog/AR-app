import React from 'react';
import { View } from 'react-native';
import Ionicons from './icons/AppIcon';
import type { RateRow } from '../types';
import { rateFreshness, rowVerificationReceipt, type RateFreshness, type SuccessfulVerification } from '../data/rateFreshness';
import { uiJoin, type UiLabel } from '../lib/uiCopy';
import { LIGHT, type Palette } from '../theme/colors';

const SYMBOLS: Record<RateFreshness, { icon: keyof typeof Ionicons.glyphMap; label: UiLabel }> = {
  current: { icon: 'checkmark-circle', label: 'Current' }, overdue: { icon: 'time', label: 'Overdue' },
  stale: { icon: 'close-circle', label: 'Stale' }, unknown: { icon: 'help-circle-outline', label: 'Unknown' },
};
export function RateFreshnessSymbol({ row, receipt = rowVerificationReceipt(row), now = Date.now(), palette = LIGHT }: {
  row: RateRow; receipt?: SuccessfulVerification | null; now?: number;
  palette?: Pick<Palette, 'success' | 'warning' | 'danger' | 'textMuted'>;
}) {
  const state = rateFreshness(row, receipt, now), symbol = SYMBOLS[state];
  const color = state === 'current' ? palette.success : state === 'overdue' ? palette.warning
    : state === 'stale' ? palette.danger : palette.textMuted;
  return <View testID="rate-freshness" accessible accessibilityRole="image"
    accessibilityLabel={uiJoin('Freshness', ' · ', symbol.label)} style={{ width: 16, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
    <Ionicons name={symbol.icon} size={16} color={color} accessible={false} />
  </View>;
}
