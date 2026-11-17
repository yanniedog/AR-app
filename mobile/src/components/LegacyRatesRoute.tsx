import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useReadyNavigationEffect } from '../hooks/useReadyNavigationEffect';

/** Replace a retired entry while retaining the existing tab navigator and task state. */
export function LegacyRatesRoute({ defaults = {}, withinTabs = false }: { defaults?: Record<string, string>; withinTabs?: boolean }) {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const intent = JSON.stringify({ ...defaults, ...params });
  useReadyNavigationEffect(useCallback(() => {
    const destination = { pathname: '/(tabs)/browse', params: JSON.parse(intent) } as const;
    // A sibling tab handles NAVIGATE. POP_TO only handles stack entries.
    if (withinTabs) router.navigate(destination);
    else router.dismissTo(destination);
  }, [intent, withinTabs]));
  return null;
}
