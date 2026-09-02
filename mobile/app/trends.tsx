import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { scalarRouteParam } from '../src/lib/nav';

/** Preserve older Market deep links after Research moved out of the tab group. */
export default function LegacyTrendsRedirect() {
  const { focus: focusRaw } = useLocalSearchParams<{ focus?: string | string[] }>();
  const focus = scalarRouteParam(focusRaw);
  return <Redirect href={focus === 'rba'
    ? { pathname: '/research', params: { focus: 'rba' } }
    : '/research'} />;
}
