import { usePathname } from 'expo-router';
import { useLayoutEffect } from 'react';

import { shouldShowBreadcrumbs } from '../lib/breadcrumbs';

/**
 * Owns the pathname subscription for a navigator layout. The layout re-renders
 * only when the breadcrumb decision flips, not on every route change, so its
 * navigator options, tab bar and menu are not rebuilt per navigation. The
 * layout effect commits a flip before the frame paints.
 */
export function BreadcrumbRouteProbe({ hydrated, onChange }: {
  hydrated: boolean;
  onChange: (visible: boolean) => void;
}) {
  const visible = shouldShowBreadcrumbs(usePathname(), hydrated);
  useLayoutEffect(() => { onChange(visible); }, [onChange, visible]);
  return null;
}
