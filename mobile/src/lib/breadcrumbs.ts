import type { Href } from 'expo-router';

import { uiIdentifier, uiLabel, uiProductName, uiProviderName, uiSectionName, type UiCopy } from './uiCopy';
import { segLabel } from '../data/taxonomy';
import { LEDGER_LAYOUT } from '../theme/layout';
import type { RateRow, SectionKey } from '../types';
import { isPrimaryTabRootPath, normalizeAppPath, TAB_BAR_ORDER, tabHref } from './tabRouting';

export type BreadcrumbTarget =
  | { href: Href }
  | { section: SectionKey; path: string[] };

export interface Breadcrumb {
  label: UiCopy;
  target?: BreadcrumbTarget;
}

const rates: Breadcrumb = { label: 'Rates', target: { href: tabHref('browse') } };
const market: Breadcrumb = { label: 'Market', target: { href: '/(tabs)/market' } };
const about: Breadcrumb = { label: 'About', target: { href: '/about' } };
const scenario: Breadcrumb = { label: 'Calculate', target: { href: '/calculator' } };

const ROUTES: Record<string, Breadcrumb[]> = {
  '/': [rates],
  '/browse': [rates],
  '/watchlist': [{ label: 'Saved' }],
  '/market': [market],
  '/tools': [rates, scenario],
  '/matches': [rates, { label: 'Matching rates' }],
  '/banks': [rates, { label: 'Banks' }],
  '/catalogue': [rates, { label: 'No listed rate' }],
  '/compare': [rates, { label: 'Compare' }],
  '/calculator': [rates, scenario],
  '/calculation-receipt': [rates, scenario, { label: 'Calculation receipt' }],
  '/projections': [rates, scenario, { label: 'Projection' }],
  '/bank-rates': [market, { label: 'Bank rates' }],
  '/passthrough': [market, { label: 'Changes' }],
  '/research': [market, { label: 'Market research' }],
  '/trends': [market, { label: 'Market research' }],
  '/rba': [market, { label: 'Outlook' }],
  '/rba-response': [market, { label: 'Bank response' }],
  '/profile': [rates, { label: 'Profile' }],
  '/settings': [rates, { label: 'Settings' }],
  '/about': [rates, about],
  '/terms': [rates, about, { label: 'Terms and privacy' }],
  '/third-party-notices': [rates, about, { label: 'Open-source notices' }],
  '/debug-log': [rates, about, { label: 'Debug log' }],
  '/performance-audit': [rates, about, { label: 'App health audit' }],
};

function categoryTrail(section: SectionKey, path: string[]): Breadcrumb[] {
  return [
    rates,
    { label: uiSectionName(section), target: { section, path: [] } },
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
  const route = normalizeAppPath(pathname);
  let trail: Breadcrumb[];
  if (route === '/categories' || route === '/node' || route === '/search') {
    trail = categoryTrail(section, path);
    if (route === '/search') trail.push({ label: 'Search' });
  } else if (route.startsWith('/bank/')) {
    trail = [rates, { label: provider ? uiProviderName({ provider }) : uiLabel('Bank') }];
  } else if (route.startsWith('/product/') || route === '/rate-receipt') {
    if (!product && catalogueProductName && route.startsWith('/product/')) {
      return [
        rates,
        { label: uiProductName({ product_name: catalogueProductName }) },
      ];
    }
    trail = [rates];
    const productCrumb: Breadcrumb = {
      label: product ? product.row.product_name ? uiProductName(product.row) : uiIdentifier(product.row.product_key) : uiLabel('Product'),
    };
    if (product) productCrumb.target = { href: {
      pathname: '/product/[key]',
      params: { key: product.row.product_key, ...(rateIndex != null ? { ri: rateIndex } : {}) },
    } };
    trail.push(productCrumb);
    if (route === '/rate-receipt') trail.push({ label: 'Bank-call brief' });
  } else {
    trail = ROUTES[route] ?? [{ label: 'Unavailable' }];
  }
  // The final item describes the current page; only ancestors are interactive.
  return trail.map((crumb, index) => {
    if (index === trail.length - 1) return { label: crumb.label };
    if (crumb === scenario) return { label: crumb.label, target: { href: { pathname: '/calculator', params: { section } } as Href } };
    return crumb;
  });
}

export function shouldShowBreadcrumbs(pathname: string, hydrated: boolean): boolean {
  const path = normalizeAppPath(pathname);
  return hydrated
    && path !== '/onboarding'
    && !path.startsWith('/onboarding/')
    && !TAB_BAR_ORDER.some((route) => isPrimaryTabRootPath(path, route));
}

/**
 * Breadcrumbs are an at-a-glance wide/tablet affordance. On phones the bottom
 * tab bar names the section and stack back shows the journey, so the extra bar
 * is redundant and is hidden. An unknown/first-render width reads as a phone so
 * the bar only ever appears (adding its top inset), never flashes then collapses.
 */
export function breadcrumbsFitWidth(width: number): boolean {
  return width >= LEDGER_LAYOUT.wideBreakpoint;
}
