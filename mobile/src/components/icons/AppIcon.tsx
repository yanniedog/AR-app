import React from 'react';

import {
  LedgerIcon,
  type LedgerIconName,
  type LedgerIconProps,
} from './LedgerIcon';

/**
 * Product-wide semantic bridge for the pre-Rate-Ledger icon vocabulary.
 *
 * Every value resolves to local SVG geometry in LedgerIcon. Keeping the
 * vocabulary here lets older, deeply nested controls migrate without loading
 * a second icon font or quietly changing their meaning.
 */
export const APP_ICON_MAP = {
  'about': 'about',
  'alert-circle-outline': 'warning',
  'analytics-outline': 'pulse',
  'arrow-down': 'arrow-down',
  'arrow-forward': 'chevron-right',
  'arrow-up': 'arrow-up',
  'arrow-up-circle-outline': 'arrow-up',
  'business-outline': 'bank',
  'calculator-outline': 'calculator',
  'calendar-outline': 'calendar',
  'cash-outline': 'money',
  'chatbubbles-outline': 'message',
  'checkbox': 'checkbox',
  'checkmark-circle': 'success',
  'checkmark-circle-outline': 'success',
  'checkmark-done-outline': 'success',
  'chevron-back': 'chevron-left',
  'chevron-down': 'chevron-down',
  'chevron-down-outline': 'chevron-down',
  'chevron-forward': 'chevron-right',
  'chevron-up': 'chevron-up',
  'close': 'close',
  'close-circle': 'remove-circle',
  'close-circle-outline': 'remove-circle',
  'cloud-download-outline': 'download',
  'cloud-offline-outline': 'offline',
  'cloud-upload-outline': 'upload',
  'code-slash-outline': 'code',
  'copy-outline': 'copy',
  'document-text-outline': 'document',
  'download-outline': 'download',
  'finger-print': 'fingerprint',
  'flash-outline': 'pulse',
  'flask-outline': 'flask',
  'folder-outline': 'folder',
  'git-compare': 'compare',
  'git-compare-outline': 'compare',
  'help-circle-outline': 'help',
  'home': 'home',
  'information-circle-outline': 'info',
  'layers-outline': 'layers',
  'link-outline': 'link',
  'lock-closed': 'lock',
  'lock-closed-outline': 'lock',
  'notifications': 'bell',
  'notifications-outline': 'bell',
  'open-outline': 'external-link',
  'options': 'filter',
  'people-outline': 'user',
  'person-circle-outline': 'profile',
  'person-outline': 'user',
  'podium-outline': 'trophy',
  'profile': 'profile',
  'pulse-outline': 'pulse',
  'reader-outline': 'document',
  'receipt-outline': 'receipt',
  'refresh': 'refresh',
  'search': 'search',
  'search-outline': 'search',
  'settings': 'settings',
  'share-outline': 'share',
  'share-social-outline': 'share',
  'shield-checkmark-outline': 'shield',
  'speedometer-outline': 'pulse',
  'square-outline': 'checkbox-empty',
  'star': 'star-filled',
  'star-outline': 'star',
  'time': 'time',
  'trash-outline': 'remove',
  'trending-up-outline': 'changes',
  'utility': 'utility',
  'wallet': 'wallet',
  'warning-outline': 'warning',
  'wifi-outline': 'wifi',
} as const satisfies Record<string, LedgerIconName>;

export type AppIconName = keyof typeof APP_ICON_MAP;

export interface AppIconProps extends Omit<LedgerIconProps, 'name'> {
  name: AppIconName;
}

function AppIconView({ name, ...props }: AppIconProps) {
  return <LedgerIcon name={APP_ICON_MAP[name]} {...props} />;
}

const glyphMap = Object.freeze(
  Object.fromEntries(
    (Object.keys(APP_ICON_MAP) as AppIconName[]).map((name, index) => [name, index]),
  ) as Record<AppIconName, number>,
);

/** Drop-in local SVG icon component; glyphMap exists only for typed call sites. */
const AppIcon = Object.assign(AppIconView, { glyphMap });

export default AppIcon;
