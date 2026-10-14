import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
export default function LegacyTools() {
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const identity = JSON.stringify(params);
  useEffect(() => {
    router.dismissTo('/(tabs)/browse');
    router.push({ pathname: '/calculator', params: JSON.parse(identity) });
  }, [identity]);
  return null;
}
