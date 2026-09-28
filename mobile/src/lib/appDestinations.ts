import type { Href } from 'expo-router';

import { SECTION_ORDER, sectionFromSlug } from '../constants';
import type { SectionKey } from '../types';
import type { LedgerIconName } from '../components/icons/LedgerIcon';
import { buildBrowseRouteParams } from './browseRoute';
import { normalizeAppPath, tabHref } from './tabRouting';

export type AppDestinationId =
  | 'home' | 'rates' | 'search' | 'matches' | 'banks' | 'categories' | 'catalogue'
  | 'saved' | 'market' | 'bank-rates' | 'changes' | 'bank-response' | 'rba' | 'research'
  | 'tools' | 'calculator' | 'projections' | 'profile' | 'settings' | 'about';

export type AppDestinationIcon = LedgerIconName;

export interface AppDestination {
  id: AppDestinationId;
  label: string;
  icon: AppDestinationIcon;
  href: Href | ((section: SectionKey) => Href);
  /** Exact route shown as selected; parents never masquerade as the current page. */
  path: string;
}

export interface AppDestinationGroup {
  id: 'home' | 'rates' | 'saved' | 'market' | 'tools' | 'app';
  label: string;
  destinations: readonly AppDestination[];
}

export const APP_DESTINATION_GROUPS: readonly AppDestinationGroup[] = [
  {
    id: 'home', label: 'Start', destinations: [
      { id: 'home', label: 'Home', icon: 'home', href: '/(tabs)', path: '/' },
    ],
  },
  {
    id: 'rates', label: 'Rates', destinations: [
      { id: 'rates', label: 'Find rates', icon: 'search', href: tabHref('browse'), path: '/browse' },
      { id: 'search', label: 'Search products', icon: 'search', href: (section) => ({ pathname: '/search', params: { section } }), path: '/search' },
      { id: 'matches', label: 'Matched rates', icon: 'filter', href: '/matches', path: '/matches' },
      { id: 'banks', label: 'Banks', icon: 'bank', href: '/banks', path: '/banks' },
      { id: 'categories', label: 'Product categories', icon: 'layers', href: (section) => ({ pathname: '/categories', params: buildBrowseRouteParams(section, []) }), path: '/categories' },
      { id: 'catalogue', label: 'Products without listed rates', icon: 'document', href: '/catalogue', path: '/catalogue' },
    ],
  },
  {
    id: 'saved', label: 'Saved', destinations: [
      { id: 'saved', label: 'Saved products', icon: 'star', href: '/(tabs)/watchlist', path: '/watchlist' },
    ],
  },
  {
    id: 'market', label: 'Market', destinations: [
      { id: 'market', label: 'Market overview', icon: 'changes', href: '/(tabs)/market', path: '/market' },
      { id: 'bank-rates', label: 'Bank rates over time', icon: 'bank', href: '/bank-rates', path: '/bank-rates' },
      { id: 'changes', label: 'Recent rate changes', icon: 'changes', href: '/passthrough', path: '/passthrough' },
      { id: 'bank-response', label: 'Bank response to the RBA', icon: 'compare', href: (section) => ({ pathname: '/rba-response', params: { section } }), path: '/rba-response' },
      { id: 'rba', label: 'RBA rates and outlook', icon: 'bank', href: '/rba', path: '/rba' },
      { id: 'research', label: 'Market research', icon: 'flask', href: '/research', path: '/research' },
    ],
  },
  {
    id: 'tools', label: 'Tools', destinations: [
      { id: 'tools', label: 'Tools overview', icon: 'calculator', href: '/(tabs)/tools', path: '/tools' },
      { id: 'calculator', label: 'Check my rate', icon: 'calculator', href: (section) => ({ pathname: '/calculator', params: { section } }), path: '/calculator' },
      { id: 'projections', label: 'Project my balance', icon: 'changes', href: (section) => ({ pathname: '/projections', params: { section } }), path: '/projections' },
      { id: 'profile', label: 'Your profile', icon: 'profile', href: '/profile', path: '/profile' },
    ],
  },
  {
    id: 'app', label: 'App', destinations: [
      { id: 'settings', label: 'Settings', icon: 'settings', href: '/settings', path: '/settings' },
      { id: 'about', label: 'About and help', icon: 'about', href: '/about', path: '/about' },
    ],
  },
] as const;

export function destinationHref(destination: AppDestination, section: SectionKey): Href {
  return typeof destination.href === 'function' ? destination.href(section) : destination.href;
}

export function destinationSectionFromParam(value: string | string[] | undefined): SectionKey | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  if (SECTION_ORDER.includes(raw as SectionKey)) return raw as SectionKey;
  return sectionFromSlug(raw);
}

export function destinationIsActive(id: AppDestinationId, pathname: string): boolean {
  const destination = APP_DESTINATION_GROUPS.flatMap((group) => group.destinations).find((item) => item.id === id);
  return destination?.path === normalizeAppPath(pathname);
}
