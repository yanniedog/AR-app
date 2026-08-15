import type { Href } from 'expo-router';

import { SECTION_ORDER, sectionFromSlug } from '../constants';
import type { SectionKey } from '../types';

export type AppDestinationId =
  | 'search'
  | 'banks'
  | 'scenario'
  | 'market'
  | 'settings'
  | 'about';

export type AppDestinationIcon =
  | 'search-outline'
  | 'business-outline'
  | 'calculator-outline'
  | 'pulse-outline'
  | 'settings-outline'
  | 'information-circle-outline';

export interface AppDestination {
  id: AppDestinationId;
  label: string;
  icon: AppDestinationIcon;
  href: Href | ((section: SectionKey) => Href);
}

export interface AppDestinationGroup {
  id: 'rates' | 'research' | 'more';
  label: string;
  destinations: readonly AppDestination[];
}

export const APP_DESTINATION_GROUPS: readonly AppDestinationGroup[] = [
  {
    id: 'rates',
    label: 'Rates',
    destinations: [
      {
        id: 'search',
        label: 'Search rates',
        icon: 'search-outline',
        href: (section) => ({ pathname: '/search', params: { section } }),
      },
      { id: 'banks', label: 'Banks', icon: 'business-outline', href: '/banks' },
      {
        id: 'scenario',
        label: 'My scenario',
        icon: 'calculator-outline',
        href: (section) => ({ pathname: '/calculator', params: { section } }),
      },
    ],
  },
  {
    id: 'research',
    label: 'Research',
    destinations: [
      { id: 'market', label: 'Market research', icon: 'pulse-outline', href: '/(tabs)/trends' },
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
  if (id === 'search') return path.startsWith('/search') || path.startsWith('/compare');
  if (id === 'banks') return path === '/banks' || path.startsWith('/bank/');
  if (id === 'scenario') return path.startsWith('/calculator') || path.startsWith('/projections');
  if (id === 'market') return path.startsWith('/trends') || path === '/rba';
  if (id === 'settings') return path.startsWith('/settings');
  return path.startsWith('/about')
    || path.startsWith('/terms')
    || path.startsWith('/debug-log')
    || path.startsWith('/performance-audit');
}
