import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { scalarRouteParam } from '../src/lib/nav';
export default function LegacyChanges() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const target = scalarRouteParam(params.date) ? '/rba-response' : '/(tabs)/market';
  const identity = JSON.stringify(params);
  useEffect(() => { router.dismissTo({ pathname: target, params: JSON.parse(identity) }); }, [identity, target]);
  return null;
}
