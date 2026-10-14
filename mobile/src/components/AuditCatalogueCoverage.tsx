import { uiLabel } from '../lib/uiCopy';
import React, { useState } from 'react';
import { View } from 'react-native';
import type { AppHealthCheck, AppHealthMetricValue } from '../lib/appHealth/types';
import type { CatalogueCounts, CatalogueSectionCoverage } from '../lib/appHealth/catalogueCoverage';
import type { DeepAuditDerivedInputs } from '../lib/performanceAuditPlan';
import { uiCount, uiDetailsProductReference, uiIdentifier, uiJoin, uiProviderName, uiSectionName } from '../lib/uiCopy';
import { useStore } from '../data/store';
import { AppText, Button, Card } from './ui';

const catalogueCounts = (value: CatalogueCounts | null) => uiJoin(uiCount(value?.products), ' ', 'products', ' · ', uiCount(value?.providers), ' ', 'banks', ' · ', uiCount(value?.rates), ' ', 'rates');
const metricCount = (value: AppHealthMetricValue | undefined) => uiCount(typeof value === 'number' ? value : undefined);
const exclusions = (value: CatalogueSectionCoverage['excluded']) => uiJoin('Excluded', ': ', 'Profile', ' ', uiCount(value.mandatoryProfile), ' · ', 'Matches', ' ', uiCount(value.suitability), ' · ', 'Token rates', ' ', uiCount(value.tokenRate));
function SectionCoverage({ section }: { section: CatalogueSectionCoverage }) {
  const [expanded, setExpanded] = useState(false);
  const [providerExpanded, setProviderExpanded] = useState<string | null>(null);
  const missing = [section.searchMissing, section.searchUnexpected, section.directoryMissing, section.directoryUnexpected];
  const mismatchCount = missing.every(value => Array.isArray(value)) ? missing.reduce((total, value) => total + value!.length, 0) : null;
  return <View style={{ gap: 6 }}>
    <Button title={uiJoin(uiSectionName(section.section), ': ', catalogueCounts(section.published))} variant="secondary" icon={expanded ? 'chevron-up' : 'chevron-down'} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} />
    <AppText variant="tiny">{uiJoin('Recorded criteria', ': ', catalogueCounts(section.eligible), ' · ', section.selectedInterest ? 'Selected' : 'Hidden by profile')}</AppText>
    {expanded ? <View style={{ gap: 8 }}>
      <AppText variant="small">{uiJoin('Published', ': ', catalogueCounts(section.published))}</AppText>
      <AppText variant="small">{uiJoin('Search model', ': ', catalogueCounts(section.search))}</AppText>
      <AppText variant="small">{uiJoin('Bank model', ': ', catalogueCounts(section.directory))}</AppText>
      <AppText variant="tiny">{exclusions(section.excluded)}</AppText>
      <AppText variant="tiny" color={mismatchCount ? 'danger' : 'textMuted'}>{uiJoin('Exact tier mismatches', ': ', uiCount(mismatchCount), ' · ', 'Missing details', ': ', uiCount(section.missingDetails?.length), ' · ', 'Missing search entries', ': ', uiCount(section.missingSearchIndex?.length))}</AppText>
      {section.providers.map(provider => <View key={provider.provider} style={{ gap: 3 }}>
        <Button title={uiJoin(uiProviderName(provider), ': ', uiCount(provider.eligible?.products), ' / ', uiCount(provider.published.products), ' ', 'products')} variant="ghost" icon={providerExpanded === provider.provider ? 'chevron-up' : 'chevron-down'} accessibilityState={{ expanded: providerExpanded === provider.provider }} onPress={() => setProviderExpanded(providerExpanded === provider.provider ? null : provider.provider)} />
        {providerExpanded === provider.provider ? <View style={{ gap: 3, paddingLeft: 12 }}>
          <AppText variant="tiny">{uiJoin('Published', ': ', catalogueCounts(provider.published))}</AppText>
          <AppText variant="tiny">{uiJoin('Search model', ': ', catalogueCounts(provider.search))}</AppText>
          <AppText variant="tiny">{uiJoin('Bank model', ': ', catalogueCounts(provider.directory))}</AppText>
          <AppText variant="tiny">{exclusions(provider.excluded)}</AppText>
          <AppText variant="tiny">{uiJoin('Missing details', ': ', uiCount(provider.missingDetails), ' · ', 'Missing search entries', ': ', uiCount(provider.missingSearchIndex))}</AppText>
        </View> : null}
      </View>)}
    </View> : null}
  </View>;
}
/** Retains count reconciliation and separates model coverage from rendered samples. */
export function AuditCatalogueCoverage({ check, sampling }: { check: AppHealthCheck | undefined; sampling?: DeepAuditDerivedInputs['sampling'] }) {
  const details = useStore(state => state.details);
  const [showDetailsOnly, setShowDetailsOnly] = useState(false), [showUnrepresentedBanks, setShowUnrepresentedBanks] = useState(false);
  if (!check && !sampling) return null;
  const sections = Array.isArray(check?.localEvidence?.sections) ? check!.localEvidence!.sections as CatalogueSectionCoverage[] : [];
  const detailsOnly = Array.isArray(check?.localEvidence?.detailsOnlyProductKeys) ? check!.localEvidence!.detailsOnlyProductKeys as string[] : null;
  const unrepresentedBanks = Array.isArray(check?.localEvidence?.brandedProvidersWithoutPublishedRates) ? check!.localEvidence!.brandedProvidersWithoutPublishedRates as string[] : null;
  const metrics = check?.metrics ?? {};
  return <Card style={{ gap: 10 }}>
    <AppText variant="h3">{uiLabel("Catalogue coverage")}</AppText>
    <AppText variant="small" color={check?.status === 'fail' ? 'danger' : 'textMuted'}>{uiJoin('Status', ': ', check?.status === 'pass' ? 'Verified' : check?.status === 'fail' ? 'Failed' : check?.status === 'warn' ? 'Partial' : 'Unverified')}</AppText>
    <AppText variant="small">{uiJoin('Published', ': ', metricCount(metrics.publishedProducts), ' ', 'products', ' · ', metricCount(metrics.publishedProviders), ' ', 'banks')}</AppText>
    <AppText variant="small">{uiJoin('Recorded criteria', ': ', metricCount(metrics.eligibleProducts), ' ', 'products', ' · ', metricCount(metrics.eligibleProviders), ' ', 'banks')}</AppText>
    <AppText variant="tiny">{uiJoin('Basis', ': ', 'List models', ' · ', 'Rendered coverage', ': ', 'Not assessed')}</AppText>
    <AppText variant="tiny">{uiJoin('Banks without listed rates', ': ', metricCount(metrics.brandedProvidersWithoutPublishedRates))}</AppText>
    {unrepresentedBanks?.length ? <><Button title={showUnrepresentedBanks ? 'Hide' : 'Show'} variant="ghost" accessibilityState={{ expanded: showUnrepresentedBanks }} onPress={() => setShowUnrepresentedBanks(!showUnrepresentedBanks)} />{showUnrepresentedBanks ? unrepresentedBanks.map(provider => <AppText key={provider} variant="tiny">{uiProviderName({provider})}</AppText>) : null}</> : null}
    {sampling ? <View style={{ gap: 3 }}>
      <AppText variant="small">{uiJoin('Planned foreground sample', ': ', uiCount(sampling.sampledProducts), ' ', 'products', ' · ', uiCount(sampling.sampledProviders), ' ', 'banks', ' · ', uiCount(sampling.sampledSections), ' ', 'Categories')}</AppText>
      <AppText variant="tiny">{uiJoin('Rendered coverage', ': ', 'Not assessed')}</AppText>
      <AppText variant="tiny" selectable>{uiJoin('Sample seed', ': ', uiIdentifier(sampling.seed))}</AppText>
    </View> : null}
    <AppText variant="tiny">{uiJoin('Source products', ': ', metricCount(metrics.sourceProducts), ' · ', 'Source rates', ': ', metricCount(metrics.sourceRates), ' · ', 'Explained exclusions', ': ', metricCount(metrics.explainedSourceRateExclusions))}</AppText>
    <AppText variant="tiny">{uiJoin('Upstream completeness', ': ', 'Unverified')}</AppText>
    <AppText variant="tiny">{uiJoin('Details without listed rates', ': ', metricCount(metrics.detailsOnlyProducts))}</AppText>
    {detailsOnly?.length ? <><Button title={showDetailsOnly ? 'Hide' : 'Show'} variant="ghost" accessibilityState={{ expanded: showDetailsOnly }} onPress={() => setShowDetailsOnly(!showDetailsOnly)} />{showDetailsOnly ? detailsOnly.map(key => <AppText key={key} variant="tiny" selectable>{uiDetailsProductReference(details, key)}</AppText>) : null}</> : null}
    {!sections.length ? <AppText variant="small">{uiLabel("Unavailable")}</AppText> : null}
    {sections.map(section => <SectionCoverage key={section.section} section={section} />)}
  </Card>;
}
