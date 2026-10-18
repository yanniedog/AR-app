import type { RateScenario } from '../../data/publicRateModel';
import { usePublicRateCatalogue } from '../../data/publicRateCatalogue';
import { PublicRateEvidence } from '../scenario/PublicRateEvidence';
import { ActivityPeriodCalculation } from './ActivityPeriodCalculation';
import { MortgagePeriodCalculation } from './MortgagePeriodCalculation';
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
import { uiLabel, uiDate, uiIdentifier, uiJoin, uiProductName, uiProviderName, uiPublicProductName } from '../../lib/uiCopy';
export function DetailsOnlyProduct({ productKey, programmeId, rateScenario }: { productKey: string; programmeId?: string; rateScenario?: RateScenario }) {
  const { details, manifest, loading, retry } = useDetailsCatalogue();
  const detail = details && Object.hasOwn(details.products, productKey) ? details.products[productKey] : null;
  const identity = detailsDisplayIdentity(detail);
  const catalogue = usePublicRateCatalogue(manifest);
  const product = catalogue.getProduct(productKey);
  return <ScreenScrollView><Stack.Screen options={{ title: 'Product details' }} /><View style={{ gap: 12 }}>
    <AppText weight="700">{product ? uiPublicProductName(product) : identity.name ? uiProductName({ product_name: identity.name }) : uiLabel('Product')}
    </AppText>
    {(identity.provider || identity.productCategory) && <AppText variant="small">{uiJoin(identity.provider ? uiProviderName({ provider: identity.provider }) : null, identity.productCategory ? uiJoin(' · ', uiIdentifier(identity.productCategory)) : null)}</AppText>}
    <PublicRateEvidence productKey={productKey} programmeId={programmeId} scenario={rateScenario} />
    {detail ? <>
      <AppText variant="small">{uiJoin('Published', ' · ', uiDate(manifest?.run_date), ' · ', 'Rate', ' · ', 'Unavailable')}</AppText>
      <DetailGroup loading={false} icon="cash-outline" title="Fees" items={detail.fees} /><DetailGroup loading={false} icon="person-outline" title="Eligibility" items={detail.eligibility} />
      <DetailGroup loading={false} icon="information-circle-outline" title="Features" items={detail.features} /><DetailGroup loading={false} icon="information-circle-outline" title="Constraints" items={detail.constraints} />
      <ProductFacts productDetails={detail} /><OfficialLinks links={detail.links} sourceDocuments={detail.sourceDocuments} />
      <EligibilityAssessment productKey={productKey} />
      {identity.productCategory === 'TRANS_AND_SAVINGS_ACCOUNTS' && <><SavingsPeriodCalculation productKey={productKey} /><ActivityPeriodCalculation productKey={productKey} /></>}
      {identity.productCategory === 'RESIDENTIAL_MORTGAGES' && <MortgagePeriodCalculation productKey={productKey} />}<ProductTermsDisclosure productKey={productKey} />
    </> : loading ? <AppText variant="small">{uiLabel("Loading product details")}</AppText> : <>
      <AppText variant="small">{uiLabel(details ? 'Unavailable' : 'Unverified')}</AppText>
      <Button title="Retry" variant="secondary" onPress={retry} />
    </>}
  </View></ScreenScrollView>;
}
