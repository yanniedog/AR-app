import { uiLabel } from "../src/lib/uiCopy";
import React, { startTransition, useCallback } from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { SegmentedControl } from '../src/components/controls';
import { RateCheckWorkspace } from '../src/components/calculation/RateCheckWorkspace';
import { ProjectionWorkspace } from '../src/components/calculation/ProjectionWorkspace';
import { calculationMode } from '../src/lib/calculationTarget';
import { destinationSectionFromParam } from '../src/lib/appDestinations';
import { useStore } from '../src/data/store';
import { useTheme } from '../src/theme/ThemeProvider';

/** One task destination and one persisted scenario, with two calculation modes. */
export default function Calculate() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ mode?: string | string[]; section?: string | string[] }>();
  const mode = calculationMode(params.mode);
  const activeSection = useStore(state => state.activeSection);
  const section = destinationSectionFromParam(params.section) ?? activeSection;
  const changeMode = useCallback((next: string) => {
    startTransition(() => {
      router.setParams({ mode: next, section });
    });
  }, [section]);
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Stack.Screen options={{ title: 'Calculate' }} />
      <View style={{ paddingHorizontal: 16 }}>
        <SegmentedControl
          options={[{ label: uiLabel("Rate check"), value: 'check' }, { label: uiLabel("Projection"), value: 'project' }]}
          value={mode}
          onChange={changeMode}
        />
      </View>
      {mode === 'project' ? <ProjectionWorkspace /> : <RateCheckWorkspace />}
    </View>
  );
}
