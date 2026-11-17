import { useProductCriteria } from '../../hooks/useProductCriteria';
import { useStore } from '../../data/store';
import { ProductDocuments } from './ProductDocuments';
import { ProductPageLinks } from './ProductPageLink';
import React, { useState } from 'react';
import { View } from 'react-native';
import type { ProductDetail } from '../../types';
import { AppText, Card, Disclosure } from '../ui';
import { DetailGroup, ProductFacts } from './ProductDetailParts';
import { ProductTermsDisclosure } from './ProductTermsDisclosure';
import { ProductEvidenceDisclosure } from './ProductEvidenceDisclosure';
import { uiCount, uiJoin, uiLabel, uiProductName, uiProviderName, type UiText } from '../../lib/uiCopy';

export function publishedItemCount(items: unknown[] | undefined): UiText {
  return items?.length ? uiCount(items.length) : uiLabel('Unknown');
}

/** All reported items remain reachable; a count never implies complete terms. */
export function ComparisonDisclosures({
  name, provider, productKey, productDetails, loading,
}: {
  name: string;
  provider: string;
  productKey: string;
  productDetails?: ProductDetail;
  loading: boolean;
}) {
  const manifest = useStore(state => state.manifest);
  const details = useStore(state => state.details);
  const productCriteria = useProductCriteria(manifest, details?.products, true);
  const descriptiveDetail = productCriteria.lookup?.[productKey] ?? productDetails;
  return (
    <ProductPageLinks overview={productDetails?.links?.overview} productDetails={descriptiveDetail}><Card variant="outlined" style={{ gap: 12 }}>
      <View>
        <AppText variant="body" weight="700">{uiProductName({ product_name: name })}</AppText>
        <AppText variant="small" color="textMuted">{uiProviderName({ provider })}</AppText>
      </View>
      <AppText variant="small" color="textMuted">{uiJoin('Coverage', ' · ', 'Unverified', ' · ', 'Eligibility unverified')}</AppText>
      <DetailGroup title="Fees" icon="cash-outline" items={productDetails?.fees} loading={loading} />
      <DetailGroup title="Eligibility" icon="person-outline" items={productDetails?.eligibility} loading={loading} />
      <DetailGroup title="Features" icon="information-circle-outline" items={productDetails?.features} loading={loading} />
      <DetailGroup title="Constraints" icon="information-circle-outline" items={productDetails?.constraints} loading={loading} />
      {!loading && !productDetails ? <AppText variant="small">{uiLabel("Product details unavailable")}</AppText> : null}
      <ProductFacts productDetails={descriptiveDetail ?? null} />
      <ProductDocuments productDetails={descriptiveDetail} />
      <ProductTermsDisclosure productKey={productKey} />
      <ProductEvidenceDisclosure productKey={productKey} />
    </Card></ProductPageLinks>
  );
}

/** Engine support does not establish approved product contracts or customer scenarios. */
export function PersonalCostComparisonDisclosure() {
  const [open, setOpen] = useState(false);
  return <Disclosure title="Total-cost difference" open={open} onToggle={() => setOpen(value => !value)}>
    <AppText variant="small">{uiLabel("Unavailable")}</AppText>
    <AppText variant="small" color="textMuted">{uiJoin('Fees unverified', ' · ', 'Eligibility unverified')}</AppText>
  </Disclosure>;
}
