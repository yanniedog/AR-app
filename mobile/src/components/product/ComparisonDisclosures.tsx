import React from 'react';
import { View } from 'react-native';
import type { ProductDetail } from '../../types';
import { AppText, Card } from '../ui';
import { DetailGroup, OfficialLinks, ProductFacts } from './ProductDetailParts';
import { ProductTermsDisclosure } from './ProductTermsDisclosure';

export function publishedItemCount(items: unknown[] | undefined): string {
  return items?.length ? `${items.length} reported` : 'Not captured';
}

/** All reported items remain reachable; a count never implies complete terms. */
export function ComparisonDisclosures({
  name, provider, productKey, detail, loading,
}: {
  name: string;
  provider: string;
  productKey: string;
  detail?: ProductDetail;
  loading: boolean;
}) {
  return (
    <Card variant="outlined" style={{ gap: 12 }}>
      <View>
        <AppText variant="body" weight="700">{name}</AppText>
        <AppText variant="small" color="textMuted">{provider}</AppText>
      </View>
      <AppText variant="small" color="textMuted">
        Document completeness unverified. Eligibility has not been assessed for you.
      </AppText>
      {detail?.description ? <AppText variant="small">{detail.description}</AppText> : null}
      <DetailGroup title="Fees" icon="cash-outline" items={detail?.fees} loading={loading} />
      <DetailGroup title="Eligibility" icon="person-outline" items={detail?.eligibility} loading={loading} />
      <DetailGroup title="Features" icon="information-circle-outline" items={detail?.features} loading={loading} />
      <DetailGroup title="Constraints" icon="information-circle-outline" items={detail?.constraints} loading={loading} />
      {!loading && !detail ? <AppText variant="small">Product details unavailable.</AppText> : null}
      <ProductFacts detail={detail ?? null} />
      <OfficialLinks links={detail?.links} sourceDocuments={detail?.sourceDocuments} />
      <ProductTermsDisclosure productKey={productKey} />
    </Card>
  );
}
