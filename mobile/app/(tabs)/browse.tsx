import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';

import { DestinationRow, NavigationHub } from '../../src/components/NavigationHub';
import { LedgerAction, LedgerSection, LedgerText } from '../../src/components/ledger';
import { SECTIONS } from '../../src/constants';
import { sectionSegmentOptions, resolveInterestSection } from '../../src/data/interests';
import { profileSelectionCount } from '../../src/data/profile';
import { useStore } from '../../src/data/store';
import { openBrowse, openSearch } from '../../src/lib/nav';

export default function Rates() {
  const params = useLocalSearchParams<{ section?: string | string[]; path?: string | string[]; request?: string | string[] }>();
  const interests = useStore(s => s.prefs.interests);
  const activeSection = useStore(s => s.activeSection);
  const filters = useStore(s => s.prefs.profileFilters);
  const section = resolveInterestSection(interests, activeSection);
  const categories = sectionSegmentOptions(interests);
  const filterCount = profileSelectionCount(filters);
  const actions = useMemo(() => ({ 'rates.open': () => undefined, 'rates.categories.open': () => openBrowse(section) }), [section]);

  // Clear the mounted tab before opening a legacy drill, so Back and Rates
  // always return to the hub instead of re-opening the bookmarked category.
  const legacySection = params.section;
  const legacyPath = params.path;
  const legacyRequest = params.request;
  const handledLegacy = useRef<string | null>(null);
  useEffect(() => {
    if (legacySection == null && legacyPath == null && legacyRequest == null) {
      handledLegacy.current = null;
      return;
    }
    const signature = JSON.stringify([legacySection, legacyPath, legacyRequest]);
    if (handledLegacy.current === signature) return;
    handledLegacy.current = signature;
    router.setParams({ section: undefined, path: undefined, request: undefined });
    router.push({ pathname: '/categories', params: {
      ...(legacySection != null ? { section: legacySection } : {}),
      ...(legacyPath != null ? { path: legacyPath } : {}),
      ...(legacyRequest != null ? { request: legacyRequest } : {}),
    } });
  }, [legacyPath, legacyRequest, legacySection]);
  return (
    <NavigationHub title="Find a rate" description="Choose a product type to search and compare." surface="rates.hub" route="/browse" actions={actions}>
      <View>
        {categories.map(({ value }) => (
          <DestinationRow key={value} title={SECTIONS[value].title} description={SECTIONS[value].blurb}
            icon={value === 'Mortgage' ? 'home' : value === 'Savings' ? 'wallet' : 'time'} onPress={() => openSearch(value)} />
        ))}
      </View>
      <LedgerSection title="Your matches">
        <LedgerText tone="mutedInk">{filterCount ? 'Your profile is applied when finding products.' : 'Set your needs to narrow the products you see.'}</LedgerText>
        <DestinationRow title="Matched rates" description="A starting point based on your needs." icon="filter" onPress={() => router.push('/matches')} />
        <LedgerAction label="Edit profile and product types" variant="quiet" onPress={() => router.push('/profile')} />
      </LedgerSection>
      <LedgerSection title="Other ways to browse">
        <DestinationRow title="Banks" description="Find a bank and view its products." icon="bank" onPress={() => router.push('/banks')} />
        <DestinationRow title="Product categories" description="Browse by loan type, term or account features." icon="layers" onPress={() => openBrowse(section)} />
        <DestinationRow title="Products without listed rates" description="View product details when no rate is published." icon="document" onPress={() => router.push('/catalogue')} />
      </LedgerSection>
    </NavigationHub>
  );
}
