import type { Href } from 'expo-router';

import { SECTIONS } from '../constants';
import { ROOT, segLabel } from '../data/taxonomy';
import type { RateRow, SectionKey } from '../types';

export type BreadcrumbTarget =
  | { href: Href }
  | { section: SectionKey; path: string[] };

export interface Breadcrumb {
  label: string;
  target?: BreadcrumbTarget;
}

const explore: Breadcrumb = { label: 'Explore', target: { href: '/(tabs)/browse' } };
const changes: Breadcrumb = { label: 'Changes', target: { href: '/(tabs)/passthrough' } };
const about: Breadcrumb = { label: 'About', target: { href: '/about' } };
const scenario: Breadcrumb = { label: 'My scenario', target: { href: '/calculator' } };

const ROUTES: Record<string, Breadcrumb[]> = {
  '/': [{ label: 'Today' }],
  '/watchlist': [{ label: 'My rates' }],
  '/passthrough': [changes],
  '/banks': [explore, { label: 'Banks' }],
  '/catalogue': [explore, { label: 'Products without listed rates' }],
  '/compare': [explore, { label: 'Compare' }],
  '/calculator': [explore, scenario],
  '/calculation-receipt': [explore, scenario, { label: 'Open calculation receipt' }],
  '/projections': [explore, scenario, { label: 'What if rates change?' }],
  '/research': [changes, { label: 'Rate research' }],
  '/trends': [changes, { label: 'Rate research' }],
  '/rba': [changes, { label: 'RBA rates' }],
  '/rba-response': [changes, { label: 'Bank response' }],
  '/profile': [{ label: 'Your profile' }],
  '/settings': [{ label: 'Settings' }],
  '/about': [about],
  '/terms': [about, { label: 'Terms' }],
  '/third-party-notices': [about, { label: 'Open-source notices' }],
  '/debug-log': [about, { label: 'Debug log' }],
  '/performance-audit': [about, { label: 'App health audit' }],
};

function categoryTrail(section: SectionKey, path: string[]): Breadcrumb[] {
  return [
    // Explicit category targets also clear any previous drill on the mounted tab.
    { label: 'Explore', target: { section, path: [] } },
    { label: SECTIONS[section].title, target: { section, path: [] } },
    ...path.map((segment, index) => ({
      label: segLabel(segment),
      target: { section, path: path.slice(0, index + 1) },
    })),
  ];
}

/** Canonical ancestors work for deep links as well as in-app navigation. */
export function buildBreadcrumbs({
  pathname,
  section,
  path = [],
  provider,
  product,
  catalogueProductName,
  rateIndex,
}: {
  pathname: string;
  section: SectionKey;
  path?: string[];
  provider?: string;
  // Only pass a product after the same eligibility checks as the detail screen.
  product?: { section: SectionKey; row: RateRow } | null;
  // Only pass display identity from the verified, eligible details catalogue.
  catalogueProductName?: string | null;
  rateIndex?: string;
}): Breadcrumb[] {
  const route = pathname.split(/[?#]/, 1)[0].replace(/^\/\(tabs\)(?=\/|$)/, '').replace(/\/$/, '') || '/';
  let trail: Breadcrumb[];
  if (route === '/browse' || route === '/node' || route === '/search') {
    trail = categoryTrail(section, path);
    if (route === '/search') trail.push({ label: 'Search' });
  } else if (route.startsWith('/bank/')) {
    trail = [explore, { label: 'Banks', target: { href: '/banks' } }, { label: provider || 'Bank' }];
  } else if (route.startsWith('/product/') || route === '/rate-receipt') {
    if (!product && catalogueProductName && route.startsWith('/product/')) {
      return [
        { label: 'Explore', target: { section, path: [] } },
        { label: 'Products without listed rates', target: { href: '/catalogue' } },
        { label: catalogueProductName },
      ];
    }
    const segments = product?.row.taxonomy_path?.split('.').filter(Boolean) ?? [];
    trail = product
      ? categoryTrail(product.section, segments[0] === ROOT[product.section] ? segments.slice(1) : [])
      : [explore];
    trail.push({
      label: product?.row.product_name || 'Product',
      ...(product ? { target: { href: {
        pathname: '/product/[key]',
        params: { key: product.row.product_key, ...(rateIndex != null ? { ri: rateIndex } : {}) },
      } as Href } } : {}),
    });
    if (route === '/rate-receipt') trail.push({ label: 'Bank-call brief' });
  } else {
    trail = ROUTES[route] ?? [{ label: 'Page not found' }];
  }
  // The final item describes the current page; only ancestors are interactive.
  return trail.map((crumb, index) => {
    if (index === trail.length - 1) return { label: crumb.label };
    if (crumb === explore) return { label: crumb.label, target: { section, path: [] } };
    if (crumb === scenario) return { label: crumb.label, target: { href: { pathname: '/calculator', params: { section } } as Href } };
    return crumb;
  });
}

export function shouldShowBreadcrumbs(pathname: string, onboarded: boolean): boolean {
  return onboarded && pathname !== '/onboarding';
}
