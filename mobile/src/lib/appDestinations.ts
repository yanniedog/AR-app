import type { Href } from 'expo-router';

import { SECTION_ORDER, sectionFromSlug } from '../constants';
import type { SectionKey } from '../types';

export type AppDestinationId =
  | 'today'
  | 'explore'
  | 'home-loans'
  | 'savings'
  | 'term-deposits'
  | 'search'
  | 'banks'
  | 'compare'
  | 'saved'
  | 'scenario'
  | 'projections'
  | 'changes'
  | 'bank-response'
  | 'market'
  | 'why-rates-move'
  | 'settings'
  | 'about';

export type AppDestinationIcon =
  | 'home-outline'
  | 'compass-outline'
  | 'wallet-outline'
  | 'time-outline'
  | 'search-outline'
  | 'business-outline'
  | 'star-outline'
  | 'calculator-outline'
  | 'analytics-outline'
  | 'swap-vertical-outline'
  | 'git-compare-outline'
  | 'pulse-outline'
  | 'help-circle-outline'
  | 'settings-outline'
  | 'information-circle-outline';

export interface AppDestination {
  id: AppDestinationId;
  label: string;
  icon: AppDestinationIcon;
  href: Href | ((section: SectionKey) => Href);
}

export interface AppDestinationGroup {
  id: 'start' | 'your-rates' | 'market' | 'more';
  label: string;
  destinations: readonly AppDestination[];
}

export const APP_DESTINATION_GROUPS: readonly AppDestinationGroup[] = [
  {
    id: 'start',
    label: 'Start',
    destinations: [
      { id: 'today', label: 'Today', icon: 'home-outline', href: '/(tabs)' },
      { id: 'explore', label: 'Explore', icon: 'compass-outline', href: '/(tabs)/browse' },
      {
        id: 'home-loans',
        label: 'Home loans',
        icon: 'home-outline',
        href: { pathname: '/(tabs)/browse', params: { section: 'home-loans' } },
      },
      {
        id: 'savings',
        label: 'Savings accounts',
        icon: 'wallet-outline',
        href: { pathname: '/(tabs)/browse', params: { section: 'savings' } },
      },
      {
        id: 'term-deposits',
        label: 'Term deposits',
        icon: 'time-outline',
        href: { pathname: '/(tabs)/browse', params: { section: 'term-deposits' } },
      },
      {
        id: 'search',
        label: 'Search rates',
        icon: 'search-outline',
        href: (section) => ({ pathname: '/search', params: { section } }),
      },
      { id: 'banks', label: 'Banks', icon: 'business-outline', href: '/banks' },
      {
        id: 'compare',
        label: 'Compare products',
        icon: 'git-compare-outline',
        href: (section) => ({ pathname: '/search', params: { section, compare: '1' } }),
      },
    ],
  },
  {
    id: 'your-rates',
    label: 'Your rates',
    destinations: [
      { id: 'saved', label: 'My rates', icon: 'star-outline', href: '/(tabs)/watchlist' },
      {
        id: 'scenario',
        label: 'My scenario',
        icon: 'calculator-outline',
        href: (section) => ({ pathname: '/calculator', params: { section } }),
      },
      {
        id: 'projections',
        label: 'What if rates change?',
        icon: 'analytics-outline',
        href: (section) => ({ pathname: '/projections', params: { section } }),
      },
    ],
  },
  {
    id: 'market',
    label: 'Rates and the RBA',
    destinations: [
      { id: 'changes', label: 'Changes', icon: 'swap-vertical-outline', href: '/(tabs)/passthrough' },
      { id: 'bank-response', label: 'Bank response', icon: 'git-compare-outline', href: '/rba-response' },
      { id: 'market', label: 'Market overview', icon: 'pulse-outline', href: '/(tabs)/trends' },
      { id: 'why-rates-move', label: 'RBA outlook', icon: 'help-circle-outline', href: '/rba' },
    ],
  },
  {
    id: 'more',
    label: 'More',
    destinations: [
      { id: 'settings', label: 'Settings', icon: 'settings-outline', href: '/(tabs)/settings' },
      { id: 'about', label: 'About', icon: 'information-circle-outline', href: '/about' },
    ],
  },
] as const;

export function destinationHref(destination: AppDestination, section: SectionKey): Href {
  return typeof destination.href === 'function' ? destination.href(section) : destination.href;
}

export function destinationSectionFromParam(
  value: string | string[] | undefined,
): SectionKey | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  if (SECTION_ORDER.includes(raw as SectionKey)) return raw as SectionKey;
  return sectionFromSlug(raw);
}

export function destinationIsActive(id: AppDestinationId, pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0]?.replace('/(tabs)', '') || '/';
  if (id === 'today') return path === '/';
  if (id === 'explore') return path === '/browse' || path.startsWith('/node');
  if (id === 'home-loans' || id === 'savings' || id === 'term-deposits') return false;
  if (id === 'search') return path.startsWith('/search');
  if (id === 'banks') return path === '/banks' || path.startsWith('/bank/');
  if (id === 'compare') return path.startsWith('/compare');
  if (id === 'saved') return path.startsWith('/watchlist');
  if (id === 'scenario') return path.startsWith('/calculator');
  if (id === 'projections') return path.startsWith('/projections');
  if (id === 'changes') return path === '/passthrough';
  if (id === 'bank-response') return path.startsWith('/rba-response');
  if (id === 'market') return path.startsWith('/trends');
  if (id === 'why-rates-move') return path === '/rba';
  if (id === 'settings') return path.startsWith('/settings');
  return path.startsWith('/about');
}
