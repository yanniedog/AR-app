import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { usePublicRateCatalogue } from '../../data/publicRateCatalogue';
import { publicRateScenario, resolvedPublicRankingRows } from '../../data/publicRateIntegration';
import type { UserRateScenario } from '../../data/userRateScenario';
import { useStore } from '../../data/store';
import type { RateRow, SectionKey } from '../../types';
import { AppText, Button, Card, Disclosure } from '../ui';
import { openProduct } from '../../lib/nav';

function coverageStatus(value: unknown): string {
  if (typeof value === 'string' && value.trim()) return value.replace(/_/g, ' ');
  if (value && typeof value === 'object') {
    const status = (value as Record<string, unknown>).state ?? (value as Record<string, unknown>).status;
    if (typeof status === 'string' && status.trim()) return status.replace(/_/g, ' ');
  }
  return 'not reported';
}

/** Loading and unresolved coverage stay visible before a complete ranking can be claimed. */
export function PublicPricingCoverage({ section, rows, scenario, compact = false }: {
  section: SectionKey; rows: readonly RateRow[]; scenario?: UserRateScenario; compact?: boolean;
}) {
  const manifest = useStore(state => state.manifest);
  const profile = useStore(state => state.prefs.profileFilters);
  const catalogue = usePublicRateCatalogue(manifest);
  const [open, setOpen] = useState(false);
  const { status: catalogueStatus, allLoaded, loadAll } = catalogue;
  useEffect(() => {
    if (catalogueStatus === 'ready' && !allLoaded) void loadAll().catch(() => undefined);
  }, [catalogueStatus, allLoaded, loadAll]);
  const pricing = useMemo(() => resolvedPublicRankingRows(rows, catalogue, row => publicRateScenario(section, scenario, profile, row)), [rows, catalogue, section, scenario, profile]);
  if (catalogue.status === 'unavailable') return <AppText variant="tiny" color="textMuted">Public pricing details: unavailable · Rates: published catalogue · Customer pricing: unverified</AppText>;
  const products = catalogue.products.filter(product => product.section === section);
  const represented = new Set(rows.map(row => row.product_key));
  const discoveryOnly = products.filter(product => !represented.has(product.productKey)).length;
  const summary = catalogue.status === 'ready' && catalogue.allLoaded
    ? `${pricing.priced} selected offers priced · ${pricing.unresolved} unresolved selected offers · ${discoveryOnly} other products identifiable`
    : 'Public pricing: incomplete · Lowest-rate ranking: unavailable · Complete-cost ranking: unavailable';
  const details = <View style={{ gap: 6 }}>
    <AppText variant="small">Identified public products: {products.length}</AppText>
    <AppText variant="tiny" color="textMuted">Exact ranking exclusions: minimums, ranges, unknown conditions, stale sources, failed checks · Cost completeness: separate · Missing fees: unknown</AppText>
    {catalogue.coverage.filter(item => item.section === section).map(item => <AppText key={`${item.providerId}:${item.section}`} variant="tiny" color="textMuted">
      {item.providerName}: source {coverageStatus(item.sourceStatus)} · acquisition {coverageStatus(item.sourceAcquisition)} · extraction {coverageStatus(item.extraction)} · reference sources {coverageStatus(item.referenceSourceStatus)} · rate {coverageStatus(item.resolutionStatus)} · cost {coverageStatus(item.costCompleteness)} · publication {coverageStatus(item.publicationStatus)}
    </AppText>)}
    {catalogue.error ? <AppText variant="tiny" color="danger">{catalogue.error}</AppText> : null}
  </View>;
  return <View style={{ marginBottom: compact ? 6 : 16 }}><Disclosure title="Public pricing coverage" summary={summary} open={open} onToggle={() => setOpen(value => !value)}>{details}</Disclosure></View>;
}

/** Unpriced product identities are searchable without becoming pretend rate rows. */
export function PublicProductDiscovery({ section, query = '', rows = [] }: {
  section: SectionKey; query?: string; rows?: readonly RateRow[];
}) {
  const manifest = useStore(state => state.manifest);
  const catalogue = usePublicRateCatalogue(manifest);
  const [limit, setLimit] = useState(20);
  const represented = new Set(rows.map(row => row.product_key));
  const needle = query.trim().toLocaleLowerCase('en-AU');
  const products = catalogue.products.filter(product => product.section === section && !represented.has(product.productKey)
    && (!needle || `${product.name} ${product.providerName} ${product.aliases.map(alias => alias.name).join(' ')}`.toLocaleLowerCase('en-AU').includes(needle)));
  if (!products.length) return null;
  return <Card style={{ marginVertical: 12, gap: 8 }}>
    <AppText variant="h3">Other identifiable products</AppText>
    <AppText variant="tiny" color="textMuted">Identified products: {products.length} · Resolution: per product · Recommendation status: excluded</AppText>
    {products.slice(0, limit).map(product => <View key={product.productId} style={{ gap: 2 }}>
      <Button title={`${product.providerName} · ${product.name}`} variant="ghost" onPress={() => openProduct(product.productKey)} />
      {product.aliases.length ? <AppText variant="tiny" color="textMuted">Aliases: {product.aliases.map(alias => alias.name).join(', ')}</AppText> : null}
      {product.status === 'legacy' ? <AppText variant="tiny" color="textMuted">New applications: unavailable</AppText> : null}
    </View>)}
    {products.length > limit ? <Button title="Show more identifiable products" variant="secondary" onPress={() => setLimit(value => value + 20)} /> : null}
  </Card>;
}
