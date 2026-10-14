import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useReadyNavigationEffect } from '../../src/hooks/useReadyNavigationEffect';
export default function LegacyTools() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const identity = JSON.stringify(params);
  useReadyNavigationEffect(useCallback(() => {
    router.dismissTo('/(tabs)/browse');
    router.push({ pathname: '/calculator', params: JSON.parse(identity) });
  }, [identity]));
  return null;
}
