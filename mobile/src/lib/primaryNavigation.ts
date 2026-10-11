import { router, type Href } from 'expo-router';

import {
  isPrimaryTabRootPath,
  TAB_BAR_ORDER,
  tabHref,
  type PrimaryTabRouteName,
} from './tabRouting';

/**
 * Return to the existing tab navigator before selecting a section. Plain
 * navigate from a detail route would append a second `(tabs)` stack entry in
 * React Navigation 7, losing the first navigator's mounted state.
 */
export function navigateToPrimaryTab(route: PrimaryTabRouteName, currentPathname: string): void {
  const href = tabHref(route);
  if (TAB_BAR_ORDER.some((root) => isPrimaryTabRootPath(currentPathname, root))) {
    router.navigate(href);
  } else {
    // POP_TO matches the root `(tabs)` route and retains its nested state. A
    // cold deep link without that route replaces the detail with the section.
    router.dismissTo(href);
  }
}

/** Shared root handling for the complete menu and breadcrumb ancestor links. */
export function navigateToAppDestination(href: Href, currentPathname: string): void {
  const path = typeof href === 'string' ? href : href.pathname;
  const root = TAB_BAR_ORDER.find((route) => isPrimaryTabRootPath(path, route));
  if (root) navigateToPrimaryTab(root, currentPathname);
  else router.navigate(href);
}
