import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

/** Replace a retired entry while retaining the existing tab navigator and task state. */
export function LegacyRatesRoute({ defaults = {} }: { defaults?: Record<string, string> }) {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const intent = JSON.stringify({ ...defaults, ...params });
  useEffect(() => {
    router.dismissTo({ pathname: '/(tabs)/browse', params: JSON.parse(intent) });
  }, [intent]);
  return null;
}
