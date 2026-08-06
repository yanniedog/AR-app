import { Redirect, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';

import { SECTION_ORDER } from '../src/constants';
import { buildBrowseRouteParams } from '../src/lib/browseRoute';
import type { SectionKey } from '../src/types';

/** Legacy /node deep links redirect into the Browse tab drill-down. */
export default function NodeScreen() {
  const { section: secRaw, path: pathRaw } = useLocalSearchParams<{ section: string; path?: string }>();
  const section = (SECTION_ORDER.includes(secRaw as SectionKey) ? secRaw : 'Mortgage') as SectionKey;
  const path = pathRaw ?? '';
  const browseParams = useMemo(
    () => buildBrowseRouteParams(section, path.split('.').filter(Boolean)),
    [path, section],
  );

  return (
    <Redirect
      href={{
        pathname: '/browse',
        params: browseParams,
      }}
    />
  );
}
