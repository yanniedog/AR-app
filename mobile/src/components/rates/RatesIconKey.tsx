import React from 'react';
import { ScrollView, View } from 'react-native';
import type { SectionKey } from '../../types';
import { uiLabel, type UiLabel } from '../../lib/uiCopy';
import type { Palette } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeProvider';
import AppIcon, { type AppIconName } from '../icons/AppIcon';
import { RATE_FRESHNESS_SYMBOLS } from '../RateFreshnessSymbol';
import { ROW_VERIFICATION_RECEIPTS_AVAILABLE } from '../../data/rateFreshness';
import { AppText } from '../ui';

type Entry = { icon: AppIconName | '—'; label: UiLabel; color?: keyof Palette };

const PRODUCT_FACTS: Record<SectionKey, readonly Entry[]> = {
  Mortgage: [
    { icon: 'cash-outline', label: 'Advertised or quoted rate', color: 'success' },
    { icon: 'calculator-outline', label: 'Comparison rate', color: 'primary' },
    { icon: 'home', label: 'Loan-to-value ratio (LVR)', color: 'primary' },
  ],
  Savings: [
    { icon: 'cash-outline', label: 'Rate', color: 'success' },
    { icon: 'wallet', label: 'Balance', color: 'primary' },
  ],
  TD: [
    { icon: 'cash-outline', label: 'Rate', color: 'success' },
    { icon: 'calendar-outline', label: 'Term', color: 'primary' },
  ],
};
const PRODUCT_STATUS: readonly Entry[] = [
  { icon: 'help-circle-outline', label: 'Unknown', color: 'warning' },
  { icon: 'warning-outline', label: 'Unresolved conditions', color: 'warning' },
  { icon: 'flash-outline', label: 'Conditional', color: 'warning' },
  { icon: 'people-outline', label: 'Eligibility', color: 'warning' },
  { icon: 'layers-outline', label: 'Tier' },
  { icon: 'square-outline', label: 'Compare' },
  { icon: 'checkbox', label: 'Selected' },
  { icon: 'star-outline', label: 'Save' },
  { icon: 'star', label: 'Saved rate', color: 'primary' },
];
const CONTROLS: readonly Entry[] = [
  { icon: 'search', label: 'Search' },
  { icon: 'options', label: 'Filter' },
  { icon: 'swap-vertical', label: 'Sort' },
  { icon: 'git-compare', label: 'Compare' },
  { icon: 'checkmark-circle', label: 'Done' },
  { icon: 'business-outline', label: 'Lenders' },
  { icon: 'ellipsis-horizontal', label: 'More' },
  { icon: 'profile', label: 'Account' },
];

export function RatesIconKey({ section }: { section: SectionKey }) {
  const theme = useTheme();
  const groups: { title: UiLabel; entries: readonly Entry[] }[] = [
    { title: 'Product facts', entries: [...PRODUCT_FACTS[section], ...PRODUCT_STATUS] },
    ...(ROW_VERIFICATION_RECEIPTS_AVAILABLE ? [{ title: 'Freshness' as const, entries: Object.values(RATE_FRESHNESS_SYMBOLS) }] : []),
    { title: 'Rates controls', entries: CONTROLS },
  ];
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 16 }}>
      {groups.map(({ title, entries }) => (
        <View key={title} style={{ gap: 8 }}>
          <AppText accessibilityRole="header" weight="600">{uiLabel(title)}</AppText>
          {entries.map(({ icon, label, color = 'textMuted' }) => (
            <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 24, alignItems: 'center' }} accessible={false} importantForAccessibility="no-hide-descendants">
                {icon === '—' ? <AppText color={color}>{uiLabel('—')}</AppText>
                  : <AppIcon name={icon} size={18} color={theme.colors[color]} accessible={false} />}
              </View>
              <AppText style={{ flex: 1 }}>{uiLabel(label)}</AppText>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
