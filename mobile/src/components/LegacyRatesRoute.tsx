import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useReadyNavigationEffect } from '../hooks/useReadyNavigationEffect';

/** Replace a retired entry while retaining the existing tab navigator and task state. */
export function LegacyRatesRoute({ defaults = {} }: { defaults?: Record<string, string> }) {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const intent = JSON.stringify({ ...defaults, ...params });
  useReadyNavigationEffect(useCallback(() => {
    router.dismissTo({ pathname: '/(tabs)/browse', params: JSON.parse(intent) });
  }, [intent]));
  return null;
}
