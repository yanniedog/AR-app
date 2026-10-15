import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** Legacy links retain the exact target and scenario in the canonical task. */
export default function LegacyProjections() {
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/calculator', params: { ...params, mode: 'project' } }} />;
}
