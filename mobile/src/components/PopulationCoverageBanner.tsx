import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CorePayload } from '../types';
import { parsePopulationAssessment } from '../data/populationAssessment';
import { uiCount, uiDate, uiJoin, uiProviderName } from '../lib/uiCopy';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './ui';

/** Non-dismissible and outside route scrolling, including Saved and audit screens. */
export function PopulationCoverageBanner({ core, topInsetConsumed = false }: { core: CorePayload | null | undefined; topInsetConsumed?: boolean }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const assessment = parsePopulationAssessment(core?.coverage?.population_assessment);
  if (!assessment) return null;
  return <View accessibilityRole="alert" accessibilityLiveRegion="polite"
    style={{ paddingHorizontal: 14, paddingBottom: 6, paddingTop: 6 + (topInsetConsumed ? 0 : insets.top), borderBottomWidth: 1, borderColor: theme.colors.primary }}>
    <AppText>{uiJoin('Coverage', ': ', 'Partial', ' / ', 'Observed products', ' / ', uiDate(assessment.observed_on))}</AppText>
    <AppText>{uiJoin('Total population', ': ', 'Unknown', ' / ', 'Missing products', ': ', 'Unknown')}</AppText>
    <AppText>{uiJoin('Published', ' / ', 'Products', ': ', uiCount(assessment.observed_counts.products), ' / ', 'Rates', ': ', uiCount(assessment.observed_counts.rates), ' / ', 'Banks', ': ', uiCount(assessment.observed_counts.providers))}</AppText>
    <ScrollView horizontal>
    {assessment.affected_providers.map(provider => <AppText key={provider.provider_id} style={{ marginRight: 16 }}>
      {uiJoin(uiProviderName({ provider: provider.provider_name }), ' / ', 'Registered', ' / ', 'Membership', ': ', 'Unknown')}
    </AppText>)}
    </ScrollView>
  </View>;
}
