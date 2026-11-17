import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { RateRow } from '../../types';
import { useStore } from '../../data/store';
import { useProductCriteria } from '../../hooks/useProductCriteria';
import { comparableProductFacts } from '../../data/productFactComparison';
import { uiNormalizedProductFact, uiProductFactValue } from '../../lib/productUiFacts';
import { uiCount, uiJoin, uiLabel, uiProductName } from '../../lib/uiCopy';
import { AppText, Button, Disclosure, Row } from '../ui';
import { ProductPageLink, ProductPageLinks } from './ProductPageLink';

export function ComparableProductFacts({ rows }: { rows: readonly RateRow[] }) {
  const [open, setOpen] = useState(false), [page, setPage] = useState(0);
  const manifest = useStore(state => state.manifest), details = useStore(state => state.details);
  const criteria = useProductCriteria(manifest, details?.products, open);
  const products = useMemo(() => [...new Map(rows.map(row => [row.product_key, row])).values()], [rows]);
  const comparisons = useMemo(() => comparableProductFacts(products.map(row => ({ key: row.product_key, detail: criteria.lookup?.[row.product_key] }))), [products, criteria.lookup]);
  const at = Math.min(page, Math.max(0, Math.ceil(comparisons.length / 12) - 1));
  return <Disclosure title="Product facts" open={open} onToggle={() => setOpen(value => !value)}><View style={{ gap: 12 }}>
    {criteria.status === 'loading' || criteria.status === 'idle' ? <AppText>{uiLabel('Loading')}</AppText> : null}
    {criteria.status === 'failed' ? <Button title="Retry" variant="secondary" onPress={criteria.retry} /> : null}
    <AppText variant="small">{uiJoin('Fields', ' · ', uiCount(comparisons.length), ' · ', 'Eligibility unverified')}</AppText>
    <ScrollView horizontal><View style={{ gap: 12 }}>
      <Row style={{ gap: 16 }}>{products.map(row => <View key={row.product_key} style={{ width: 220 }}><AppText weight="600">{uiProductName(row)}</AppText></View>)}</Row>
      {comparisons.slice(at * 12, (at + 1) * 12).map(group => <View key={group.key} style={{ gap: 6 }}>
        <AppText weight="600">{uiNormalizedProductFact(group.representative).label}</AppText>
        <Row style={{ gap: 16 }}>{products.map(row => <View key={row.product_key} style={{ width: 220, gap: 4 }}>
          <ProductPageLinks detail={criteria.lookup?.[row.product_key]}>
            {group.cells[row.product_key]?.map(fact => <ProductPageLink key={fact.id} fact={fact} label={uiNormalizedProductFact(fact).label}>
              <AppText variant="small">{uiProductFactValue(uiNormalizedProductFact(fact))}</AppText>
            </ProductPageLink>) ?? <AppText variant="small">{uiLabel('Unknown')}</AppText>}
          </ProductPageLinks>
        </View>)}</Row>
      </View>)}
    </View></ScrollView>
    {comparisons.length > 12 ? <Row style={{ gap: 8 }}>
      <Button title="Previous page" variant="secondary" disabled={at === 0} onPress={() => setPage(at - 1)} />
      <Button title="Next page" variant="secondary" disabled={(at + 1) * 12 >= comparisons.length} onPress={() => setPage(at + 1)} />
    </Row> : null}
  </View></Disclosure>;
}
