import { usePathname } from 'expo-router';
import { useLayoutEffect } from 'react';

import { shouldShowBreadcrumbs } from '../lib/breadcrumbs';

/**
 * Owns the pathname subscription for a navigator layout. The layout re-renders
 * only when the breadcrumb decision flips, not on every route change, so its
 * navigator options, tab bar and menu are not rebuilt per navigation. The
 * layout effect commits a flip before the frame paints.
 */
export function BreadcrumbRouteProbe({ hydrated, enabled = true, onChange }: {
  hydrated: boolean;
  enabled?: boolean;
  onChange: (visible: boolean) => void;
}) {
  const routeVisible = shouldShowBreadcrumbs(usePathname(), hydrated);
  // On a phone the bar never mounts. Do not still flip navigator state on
  // tab/detail transitions and rebuild every screen descriptor for no UI change.
  const visible = enabled && routeVisible;
  useLayoutEffect(() => { onChange(visible); }, [onChange, visible]);
  return null;
}
