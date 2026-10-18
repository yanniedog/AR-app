import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { usePublicRateCatalogue } from '../../data/publicRateCatalogue';
import { publicRateScenario, resolvedPublicRankingRows } from '../../data/publicRateIntegration';
import type { UserRateScenario } from '../../data/userRateScenario';
import { useStore } from '../../data/store';
import type { RateRow, SectionKey } from '../../types';
import { AppText, Button, Card, Disclosure } from '../ui';
import { openProduct } from '../../lib/nav';
import { uiCount, uiJoin, uiLabel, uiOpaqueEnum, uiPublicAliasName, uiPublicProductName, uiPublicProviderName, type UiCopy } from '../../lib/uiCopy';

function coverageStatus(value: unknown) {
  if (typeof value === 'string') return uiOpaqueEnum(value.toUpperCase());
  if (value && typeof value === 'object') {
    const status = (value as Record<string, unknown>).state ?? (value as Record<string, unknown>).status;
    if (typeof status === 'string') return uiOpaqueEnum(status.toUpperCase());
  }
  return uiLabel('Unknown');
}

/** Complete ranking requires the full selected catalogue, independently of cost coverage. */
export function PublicPricingCoverage({ section, rows, scenario, compact = false }: {
  section: SectionKey; rows: readonly RateRow[]; scenario?: UserRateScenario; compact?: boolean;
}) {
  const manifest = useStore(state => state.manifest);
  const profile = useStore(state => state.prefs?.profileFilters);
  const catalogue = usePublicRateCatalogue(manifest);
  const [open, setOpen] = useState(false);
  const { status: catalogueStatus, allLoaded, loadAll } = catalogue;
  useEffect(() => {
    if (catalogueStatus === 'ready' && !allLoaded) void loadAll().catch(() => undefined);
  }, [catalogueStatus, allLoaded, loadAll]);
  const pricing = useMemo(() => resolvedPublicRankingRows(rows, catalogue, row => publicRateScenario(section, scenario, profile, row)), [rows, catalogue, section, scenario, profile]);
  if (catalogue.status === 'unavailable') return null;
  const products = catalogue.products.filter(product => product.section === section);
  const summary = catalogue.status === 'ready' && catalogue.allLoaded
    ? uiJoin('Payable rate', ': ', uiCount(pricing.priced), ' · ', 'Unresolved offers', ': ', uiCount(pricing.unresolved))
    : uiJoin('Public pricing', ': ', 'Partial');
  return <View style={{ marginBottom: compact ? 6 : 16 }}>
    <Disclosure title={summary} open={open} onToggle={() => setOpen(value => !value)}>
      <View style={{ gap: 6 }}>
        <AppText variant="small">{uiJoin('Public products', ': ', uiCount(products.length))}</AppText>
        <AppText variant="tiny" color="textMuted">{uiJoin('Missing fees', ': ', 'Unknown', ' · ', 'Complete-cost ranking', ': ', 'Unverified')}</AppText>
        {catalogue.coverage.filter(item => item.section === section).map(item => <View key={item.providerId + ':' + item.section} style={{ gap: 4 }}>
          <AppText variant="small">{uiPublicProviderName(item)}</AppText>
          {([['Source', item.sourceStatus], ['Acquisition', item.sourceAcquisition], ['Extraction', item.extraction], ['Reference', item.referenceSourceStatus], ['Payable rate', item.resolutionStatus], ['Costs', item.costCompleteness], ['Publication', item.publicationStatus]] as const).map(([label, state]) =>
            <AppText key={label} variant="tiny" color="textMuted">{uiJoin(label, ': ', coverageStatus(state))}</AppText>)}
        </View>)}
        {catalogue.error ? <AppText variant="tiny" color="danger">{uiJoin('Public pricing', ': ', 'Failed')}</AppText> : null}
      </View>
    </Disclosure>
  </View>;
}

/** Discovery identities never become synthetic zero-price rows. */
export function PublicProductDiscovery({ section, query = '', rows = [] }: {
  section: SectionKey; query?: string; rows?: readonly RateRow[];
}) {
  const manifest = useStore(state => state.manifest);
  const catalogue = usePublicRateCatalogue(manifest);
  const [limit, setLimit] = useState(20);
  const represented = new Set(rows.map(row => row.product_key));
  const needle = query.trim().toLocaleLowerCase('en-AU');
  const products = catalogue.products.filter(product => product.section === section && !represented.has(product.productKey)
    && (!needle || (product.name + ' ' + product.providerName + ' ' + product.aliases.map(alias => alias.name).join(' ')).toLocaleLowerCase('en-AU').includes(needle)));
  if (!products.length) return null;
  return <Card style={{ marginVertical: 12, gap: 8 }}>
    <AppText variant="h3">{uiJoin('Other products', ': ', uiCount(products.length))}</AppText>
    {products.slice(0, limit).map(product => <View key={product.productId} style={{ gap: 2 }}>
      <Button title={uiJoin(uiPublicProviderName(product), ' · ', uiPublicProductName(product))} variant="ghost" onPress={() => openProduct(product.productKey)} />
      {product.aliases.length ? <AppText variant="tiny" color="textMuted">{uiJoin('Aliases', ': ', ...product.aliases.flatMap<UiCopy>((alias, i) => i ? [', ', uiPublicAliasName(alias)] : [uiPublicAliasName(alias)]))}</AppText> : null}
      {product.status === 'legacy' ? <AppText variant="tiny" color="textMuted">{uiJoin('New applications', ': ', 'Unavailable')}</AppText> : null}
    </View>)}
    {products.length > limit ? <Button title="More" variant="secondary" onPress={() => setLimit(value => value + 20)} /> : null}
  </Card>;
}
