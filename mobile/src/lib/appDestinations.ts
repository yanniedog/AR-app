import type { Href } from 'expo-router';

import { SECTION_ORDER, sectionFromSlug } from '../constants';
import type { SectionKey } from '../types';
import type { LedgerIconName } from '../components/icons/LedgerIcon';

export type AppDestinationId =
  | 'profile'
  | 'settings'
  | 'about';

export type AppDestinationIcon = Extract<LedgerIconName, 'profile' | 'settings' | 'about'>;

export interface AppDestination {
  id: AppDestinationId;
  label: string;
  icon: AppDestinationIcon;
  href: Href | ((section: SectionKey) => Href);
}

export interface AppDestinationGroup {
  id: 'more';
  label: string;
  destinations: readonly AppDestination[];
}

export const APP_DESTINATION_GROUPS: readonly AppDestinationGroup[] = [
  {
    id: 'more',
    label: 'Account and app',
    destinations: [
      { id: 'profile', label: 'Your profile', icon: 'profile', href: '/profile' },
      { id: 'settings', label: 'Settings', icon: 'settings', href: '/settings' },
      { id: 'about', label: 'About', icon: 'about', href: '/about' },
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
  if (id === 'profile') return path.startsWith('/profile');
  if (id === 'settings') return path.startsWith('/settings');
  return path.startsWith('/about')
    || path.startsWith('/terms')
    || path.startsWith('/debug-log')
    || path.startsWith('/performance-audit');
}
