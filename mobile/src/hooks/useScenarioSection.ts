import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { destinationSectionFromParam } from '../lib/appDestinations';
import type { SectionKey } from '../types';

/** Keep the screen and its persistent ancestor links on the same category. */
export function useScenarioSection(fallback: SectionKey): readonly [SectionKey, (next: SectionKey) => void] {
  const params = useLocalSearchParams<{ section?: string | string[] }>();
  const section = destinationSectionFromParam(params.section) ?? fallback;
  const changeSection = useCallback((next: SectionKey) => {
    router.setParams({ section: next });
  }, []);
  return [section, changeSection];
}
