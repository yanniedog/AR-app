import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { scalarRouteParam } from '../src/lib/nav';
import { useReadyNavigationEffect } from '../src/hooks/useReadyNavigationEffect';
export default function LegacyChanges() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const target = scalarRouteParam(params.date) ? '/rba-response' : '/(tabs)/market';
  const identity = JSON.stringify(params);
  useReadyNavigationEffect(useCallback(() => {
    router.dismissTo({ pathname: target, params: JSON.parse(identity) });
  }, [identity, target]));
  return null;
}
