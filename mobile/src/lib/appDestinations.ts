import type { Href } from 'expo-router';

import { SECTION_ORDER, sectionFromSlug } from '../constants';
import type { SectionKey } from '../types';
import type { LedgerIconName } from '../components/icons/LedgerIcon';
import { normalizeAppPath } from './tabRouting';

export type AppDestinationId = 'profile' | 'settings' | 'about';

export interface AppDestination {
  id: AppDestinationId;
  label: string;
  icon: LedgerIconName;
  href: Href;
  path: string;
}

export interface AppDestinationGroup {
  id: 'account';
  label: string;
  destinations: readonly AppDestination[];
}

/** Primary tasks live in their tabs. The account menu owns only preferences. */
export const APP_DESTINATION_GROUPS: readonly AppDestinationGroup[] = [{
  id: 'account',
  label: 'Account',
  destinations: [
    { id: 'profile', label: 'Profile', icon: 'profile', href: '/profile', path: '/profile' },
    { id: 'settings', label: 'Settings', icon: 'settings', href: '/settings', path: '/settings' },
    { id: 'about', label: 'About', icon: 'about', href: '/about', path: '/about' },
  ],
}];

export function destinationHref(destination: AppDestination): Href {
  return destination.href;
}

export function destinationSectionFromParam(value: string | string[] | undefined): SectionKey | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return undefined;
  if (SECTION_ORDER.includes(raw as SectionKey)) return raw as SectionKey;
  return sectionFromSlug(raw);
}

export function destinationIsActive(id: AppDestinationId, pathname: string): boolean {
  const destination = APP_DESTINATION_GROUPS[0].destinations.find((item) => item.id === id);
  return destination?.path === normalizeAppPath(pathname);
}
