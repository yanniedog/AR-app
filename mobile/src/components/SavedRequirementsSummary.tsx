import React, { useMemo } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { verifiedCatalogueDetails } from '../data/detailsCatalogue';
import { profileSectionCount } from '../data/profile';
import { clearHomeLoanRequirements, profileRequirementImpact, type catalogueCounts } from '../data/profileRequirements';
import { useStore } from '../data/store';
import type { RateRow, SectionKey } from '../types';
import { uiCount, uiJoin, type UiLabel } from '../lib/uiCopy';
import { AppText, Button, Row } from './ui';

function countFacts(label: UiLabel, counts: ReturnType<typeof catalogueCounts> | null) {
  return counts ? uiJoin(label, ': ', uiCount(counts.products), ' ', 'products', ' · ',
    uiCount(counts.banks), ' ', 'banks', ' · ', uiCount(counts.rates), ' ', 'rates')
    : uiJoin(label, ': ', 'Pending');
}

/** Saved scope stays visible even when temporary filters return zero products. */
export function SavedRequirementsSummary({ section, onEdit, catalogueRows }: {
  section: SectionKey; onEdit?: () => void; catalogueRows?: readonly RateRow[] | null;
}) {
  const core = useStore(state => state.core);
  const profile = useStore(state => state.prefs.profileFilters);
  const details = useStore(state => state.details);
  const integrity = useStore(state => state.coreIntegrity);
  const manifest = useStore(state => state.manifest);
  const products = verifiedCatalogueDetails(core, integrity, manifest, details)?.products ?? null;
  const count = profileSectionCount(profile, section);
  const impact = useMemo(() => profileRequirementImpact(core, profile, section, products, catalogueRows), [core, profile, products, section, catalogueRows]);
  return <View style={{ gap: 6, paddingVertical: 8 }} testID="saved-requirements-summary">
    <AppText variant="small" weight="700">{uiJoin('Saved requirements', ' · ', uiCount(count))}</AppText>
    {count > 0 ? <>
      <AppText variant="tiny" color="textMuted">{uiJoin('Scope', ': ', 'All screens')}</AppText>
      <AppText variant="tiny" color="textMuted">{countFacts('Catalogue', impact.catalogue)}</AppText>
      <AppText variant="tiny" color="textMuted">{countFacts('After saved requirements', impact.matching)}</AppText>
    </> : null}
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      <Button title="Edit saved requirements" variant="ghost" onPress={onEdit ?? (() => router.push('/profile'))} />
      {section === 'Mortgage' && count > 0 ? <Button title="Clear Home loans requirements" variant="ghost"
        onPress={() => {
          const state = useStore.getState();
          state.setPref('profileFilters', clearHomeLoanRequirements(state.prefs.profileFilters));
        }} /> : null}
    </Row>
  </View>;
}
