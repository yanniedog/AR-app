import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';

import { scalarRouteParam } from '../../src/lib/nav';

/** Preserve restored navigation state and older group-qualified Settings links. */
export default function LegacyGroupedSettingsRedirect() {
  const { focus: focusRaw, t: tRaw } = useLocalSearchParams<{
    focus?: string | string[];
    t?: string | string[];
  }>();
  const focus = scalarRouteParam(focusRaw);
  const t = scalarRouteParam(tRaw);
  return <Redirect href={focus === 'update'
    ? { pathname: '/settings', params: { focus: 'update', ...(t ? { t } : {}) } }
    : '/settings'} />;
}
