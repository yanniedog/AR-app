import React from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { SegmentedControl } from '../src/components/controls';
import { RateCheckWorkspace } from '../src/components/calculation/RateCheckWorkspace';
import { ProjectionWorkspace } from '../src/components/calculation/ProjectionWorkspace';
import { calculationMode } from '../src/lib/calculationTarget';
import { useTheme } from '../src/theme/ThemeProvider';

/** One task destination and one persisted scenario, with two calculation modes. */
export default function Calculate() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const mode = calculationMode(params.mode);
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Stack.Screen options={{ title: 'Calculate' }} />
      <View style={{ paddingHorizontal: 16 }}>
        <SegmentedControl
          options={[{ label: 'Compare rates', value: 'check' }, { label: 'Projection', value: 'project' }]}
          value={mode}
          onChange={(next) => router.setParams({ mode: next })}
        />
      </View>
      {mode === 'project' ? <ProjectionWorkspace /> : <RateCheckWorkspace />}
    </View>
  );
}
