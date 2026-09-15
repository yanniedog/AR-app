import { SavingsPeriodCalculation } from './SavingsPeriodCalculation';
import { detailsDisplayIdentity } from '../../data/detailsCatalogue';
import { EligibilityAssessment } from './EligibilityAssessment';
import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useDetailsCatalogue } from '../../hooks/useDetailsCatalogue';
import { ScreenScrollView } from '../Screen';
import { AppText, Button } from '../ui';
import { DetailGroup, OfficialLinks, ProductFacts } from './ProductDetailParts';
import { ProductTermsDisclosure } from './ProductTermsDisclosure';
export function DetailsOnlyProduct({ productKey }: { productKey: string }) {
  const { details, manifest, loading, retry } = useDetailsCatalogue();
  const detail = details && Object.hasOwn(details.products, productKey) ? details.products[productKey] : null;
  const identity = detailsDisplayIdentity(detail);
  return <ScreenScrollView><Stack.Screen options={{ title: 'Product details' }} /><View style={{ gap: 12 }}>
    <AppText weight="700">{identity.name ?? `Product key: ${productKey}`}
    </AppText>
    {(identity.provider || identity.productCategory) && <AppText variant="small">{[identity.provider, identity.productCategory].filter(Boolean).join(' · ')}</AppText>}
    {detail ? <>
      <AppText variant="small">Published details · {manifest?.run_date}. No rate is listed for this product.</AppText>
      {detail.description ? <AppText>{detail.description}</AppText> : <AppText variant="small">A product description was not supplied.</AppText>}
      <DetailGroup loading={false} icon="cash-outline" title="Fees" items={detail.fees} /><DetailGroup loading={false} icon="person-outline" title="Eligibility" items={detail.eligibility} />
      <DetailGroup loading={false} icon="information-circle-outline" title="Features" items={detail.features} /><DetailGroup loading={false} icon="information-circle-outline" title="Constraints" items={detail.constraints} />
      <ProductFacts detail={detail} /><OfficialLinks links={detail.links} sourceDocuments={detail.sourceDocuments} />
      <EligibilityAssessment productKey={productKey} />
      {identity.productCategory === 'TRANS_AND_SAVINGS_ACCOUNTS' && <SavingsPeriodCalculation productKey={productKey} />}
      <ProductTermsDisclosure productKey={productKey} />
    </> : loading ? <AppText variant="small">Loading verified product details...</AppText> : <>
      <AppText variant="small">{details ? 'Product not found in the verified details catalogue.' : 'Product details could not be verified for this publication.'}</AppText>
      <Button title="Retry product details" variant="secondary" onPress={retry} />
    </>}
  </View></ScreenScrollView>;
}
