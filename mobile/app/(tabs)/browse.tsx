import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';

import { DestinationRow, NavigationHub } from '../../src/components/NavigationHub';
import { ProductCard } from '../../src/components/ProductCard';
import { SegmentedControl } from '../../src/components/controls';
import { LedgerAction, LedgerSection, LedgerText } from '../../src/components/ledger';
import { SECTIONS } from '../../src/constants';
import { sectionSegmentOptions, resolveInterestSection } from '../../src/data/interests';
import { profileToFilters, profileSelectionCount } from '../../src/data/profile';
import { EMPTY_FILTERS, queryAndSort } from '../../src/data/selectors';
import { useStore } from '../../src/data/store';
import { rowsForSearchScope } from '../../src/data/taxonomy';
import { openBrowse, openProduct, openSearch } from '../../src/lib/nav';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import type { SectionKey } from '../../src/types';

// A few top-ranked products preview the list; the full, filterable list is one
// tap away in Search. Keep this small so Rates stays fast and scannable.
const PREVIEW_COUNT = 5;

export default function Rates() {
  const params = useLocalSearchParams<{ section?: string | string[]; path?: string | string[]; request?: string | string[] }>();
  const interests = useStore(s => s.prefs.interests);
  const activeSection = useStore(s => s.activeSection);
  const setActiveSection = useStore(s => s.setActiveSection);
  const filters = useStore(s => s.prefs.profileFilters);
  const core = useStore(s => s.core);
  const details = useStore(s => s.details);
  const includeNonStandard = useStore(s => s.prefs.includeNonStandard);
  const depositRankMetric = useStore(s => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore(s => s.prefs.mortgageRateMetric);
  const suitabilityRevision = useSuitabilityRevision();
  const section = resolveInterestSection(interests, activeSection);
  const sectionOptions = sectionSegmentOptions(interests);
  const filterCount = profileSelectionCount(filters);
  const actions = useMemo(() => ({ 'rates.open': () => undefined, 'rates.categories.open': () => openBrowse(section) }), [section]);

  // Rank the user's eligible products for the active type, profile applied, so
  // Rates opens on results rather than a directory of links.
  const ranked = useMemo(() => {
    void suitabilityRevision;
    const all = core?.sections[section]?.rates ?? [];
    if (!all.length) return [];
    const baseRows = rowsForSearchScope(all, section, [], false);
    const seeded = { ...profileToFilters(filters, section, EMPTY_FILTERS), includeNonStandard };
    return queryAndSort(baseRows, seeded, 'rate', section, details?.products ?? null, null, depositRankMetric, mortgageRateMetric);
  }, [core, section, filters, includeNonStandard, details, depositRankMetric, mortgageRateMetric, suitabilityRevision]);
  const preview = ranked.slice(0, PREVIEW_COUNT);

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

  const changeSection = (next: SectionKey) => setActiveSection(next);

  return (
    <NavigationHub title="Find a rate" description="Compare the best Australian rates by product type." surface="rates.hub" route="/browse" actions={actions}>
      {sectionOptions.length > 1 ? (
        <SegmentedControl options={sectionOptions} value={section} onChange={changeSection} />
      ) : null}

      {preview.length ? (
        <View style={{ gap: 10 }}>
          {preview.map((row) => (
            <ProductCard
              key={`${row.product_key}:${row.rate_index ?? 'none'}`}
              row={row}
              section={section}
              onPress={() => openProduct(row.product_key, row.rate_index)}
            />
          ))}
          <LedgerAction
            label={`See all ${ranked.length} ${SECTIONS[section].title.toLowerCase()}`}
            icon="search"
            onPress={() => openSearch(section)}
          />
        </View>
      ) : (
        <LedgerAction label={`Search ${SECTIONS[section].title.toLowerCase()}`} icon="search" onPress={() => openSearch(section)} />
      )}

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
