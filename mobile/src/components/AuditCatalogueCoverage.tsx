import React, { useState } from 'react';
import { View } from 'react-native';
import type { AppHealthCheck } from '../lib/appHealth/types';
import type { CatalogueCounts, CatalogueSectionCoverage } from '../lib/appHealth/catalogueCoverage';
import type { DeepAuditDerivedInputs } from '../lib/performanceAuditPlan';
import { AppText, Button, Card } from './ui';

const count = (value: unknown): string => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : 'unknown';
const catalogueCounts = (value: CatalogueCounts | null): string => value
  ? `${count(value.products)} products · ${count(value.providers)} banks · ${count(value.rates)} rate tiers`
  : 'Unknown while filtering is blocked';
const exclusions = (value: CatalogueSectionCoverage['excluded']): string =>
  `Excluded rate tiers: profile ${count(value.mandatoryProfile)} · suitability ${count(value.suitability)} · token rates ${count(value.tokenRate)}`;

function SectionCoverage({ section }: { section: CatalogueSectionCoverage }) {
  const [expanded, setExpanded] = useState(false);
  const [providerExpanded, setProviderExpanded] = useState<string | null>(null);
  const missing = [section.searchMissing, section.searchUnexpected, section.directoryMissing, section.directoryUnexpected];
  const mismatchCount = missing.every(value => Array.isArray(value))
    ? missing.reduce((total, value) => total + value!.length, 0) : null;
  return (
    <View style={{ gap: 6 }}>
      <Button title={`${section.section === 'TD' ? 'Term deposits' : section.section}: ${count(section.published.products)} published products`}
        variant="secondary" icon={expanded ? 'chevron-up' : 'chevron-down'}
        accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} />
      <AppText variant="tiny" color="textMuted">
        Eligible: {catalogueCounts(section.eligible)}{section.selectedInterest ? '' : ' · hidden from your selected categories'}
      </AppText>
      {expanded ? (
        <View style={{ gap: 8 }}>
          <AppText variant="small">Published: {catalogueCounts(section.published)}</AppText>
          <AppText variant="small">Search model: {catalogueCounts(section.search)}</AppText>
          <AppText variant="small">Banks model: {catalogueCounts(section.directory)}</AppText>
          <AppText variant="tiny" color="textMuted">{exclusions(section.excluded)}</AppText>
          <AppText variant="tiny" color={mismatchCount ? 'danger' : 'textMuted'}>
            Exact tier mismatches: {count(mismatchCount)} · missing details: {count(section.missingDetails?.length)} · missing search index entries: {count(section.missingSearchIndex?.length)}
          </AppText>
          {section.providers.map(provider => (
            <View key={provider.provider} style={{ gap: 3 }}>
              <Button title={`${provider.provider}: ${count(provider.eligible?.products)} / ${count(provider.published.products)} products eligible`}
                variant="ghost" icon={providerExpanded === provider.provider ? 'chevron-up' : 'chevron-down'}
                accessibilityState={{ expanded: providerExpanded === provider.provider }}
                onPress={() => setProviderExpanded(providerExpanded === provider.provider ? null : provider.provider)} />
              {providerExpanded === provider.provider ? (
                <View style={{ gap: 3, paddingLeft: 12 }}>
                  <AppText variant="tiny">Published: {catalogueCounts(provider.published)}</AppText>
                  <AppText variant="tiny">Search: {catalogueCounts(provider.search)}</AppText>
                  <AppText variant="tiny">Banks: {catalogueCounts(provider.directory)}</AppText>
                  <AppText variant="tiny" color="textMuted">{exclusions(provider.excluded)}</AppText>
                  <AppText variant="tiny" color="textMuted">Missing detail products: {count(provider.missingDetails)} · missing search products: {count(provider.missingSearchIndex)}</AppText>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Count reconciliation is exhaustive; screen rendering remains a labelled sample. */
export function AuditCatalogueCoverage({ check, sampling }: {
  check: AppHealthCheck | undefined;
  sampling?: DeepAuditDerivedInputs['sampling'];
}) {
  const [showDetailsOnly, setShowDetailsOnly] = useState(false);
  const [showUnrepresentedBanks, setShowUnrepresentedBanks] = useState(false);
  if (!check && !sampling) return null;
  const sections = Array.isArray(check?.localEvidence?.sections)
    ? check!.localEvidence!.sections as CatalogueSectionCoverage[] : [];
  const detailsOnly = Array.isArray(check?.localEvidence?.detailsOnlyProductKeys)
    ? check!.localEvidence!.detailsOnlyProductKeys as string[] : null;
  const unrepresentedBanks = Array.isArray(check?.localEvidence?.brandedProvidersWithoutPublishedRates)
    ? check!.localEvidence!.brandedProvidersWithoutPublishedRates as string[] : null;
  const metrics = check?.metrics ?? {};
  return (
    <Card style={{ gap: 10 }}>
      <AppText variant="h3">Banks and product coverage</AppText>
      <AppText variant="small" weight="700" color={check?.status === 'fail' ? 'danger' : 'textMuted'}>
        Catalogue check: {check?.status === 'pass' ? 'models reconciled' : check?.status === 'fail' ? 'failed' : check?.status === 'warn' ? 'gaps found' : 'unverified'}
      </AppText>
      <AppText variant="small">Published rate catalogue: {count(metrics.publishedProducts)} products across {count(metrics.publishedProviders)} banks.</AppText>
      <AppText variant="small">Eligible with recorded app settings: {count(metrics.eligibleProducts)} products across {count(metrics.eligibleProviders)} banks.</AppText>
      <AppText variant="tiny" color="textMuted">
        Reconciliation compares every loaded rate row by product and tier identity against Search and Banks models.
        Profile requirements, suitability and token-rate exclusions are shown separately below.
        Counts describe list models; they do not prove every product rendered on screen.
      </AppText>
      <AppText variant="tiny" color="textMuted">
        Banks with a brand record but no published rates: {count(metrics.brandedProvidersWithoutPublishedRates)}.
        A brand record alone does not establish published product coverage.
      </AppText>
      {unrepresentedBanks?.length ? (
        <>
          <Button title={showUnrepresentedBanks ? 'Hide banks without rates' : 'Show banks without rates'} variant="ghost"
            accessibilityState={{ expanded: showUnrepresentedBanks }} onPress={() => setShowUnrepresentedBanks(!showUnrepresentedBanks)} />
          {showUnrepresentedBanks ? <AppText variant="tiny" selectable>{unrepresentedBanks.join('\n')}</AppText> : null}
        </>
      ) : null}
      {sampling ? (
        <View style={{ gap: 3 }}>
          <AppText variant="small">Foreground sample planned: {sampling.sampledProducts} products, {sampling.sampledProviders} banks, {sampling.sampledSections} categories.</AppText>
          <AppText variant="tiny" color="textMuted">
            Randomized across categories, banks, products and exact tiers; every eligible candidate can be selected.
            The foreground sample uses full-catalogue settings with your mandatory profile requirements;
            the eligible totals above use your restored settings.
            Failed or skipped journeys do not establish rendered coverage. The same sample repeats for timing comparison.
          </AppText>
          <AppText variant="tiny" color="textMuted" selectable>Sample seed: {sampling.seed}</AppText>
        </View>
      ) : null}
      <AppText variant="tiny" color="textMuted">
        Source products: {count(metrics.sourceProducts)} · source rate rows: {count(metrics.sourceRates)}.
        Producer-explained excluded rate rows: {count(metrics.explainedSourceRateExclusions)}.
        Upstream bank catalogue completeness remains unverified: loaded records cannot prove every bank product was fetched.
      </AppText>
      <AppText variant="tiny" color="textMuted">
        Detail records without published rate rows: {count(metrics.detailsOnlyProducts)}.
        These may include products without a headline rate. They are separate from the rate catalogue and its foreground sample.
      </AppText>
      {detailsOnly?.length ? (
        <>
          <Button title={showDetailsOnly ? 'Hide detail-only identities' : 'Show detail-only identities'} variant="ghost"
            accessibilityState={{ expanded: showDetailsOnly }} onPress={() => setShowDetailsOnly(!showDetailsOnly)} />
          {showDetailsOnly ? <AppText variant="tiny" selectable>{detailsOnly.join('\n')}</AppText> : null}
        </>
      ) : null}
      {!sections.length ? <AppText variant="small" color="textMuted">Per-bank coverage is unavailable in this report. Run a new audit with a loaded catalogue.</AppText> : null}
      {sections.map(section => <SectionCoverage key={section.section} section={section} />)}
    </Card>
  );
}
