import React, { useState } from 'react';
import { View } from 'react-native';
import type { ProductDetail, ProductSourceDocument } from '../../types';
import { productDocumentActions, type ProductDocumentAction } from '../../data/productDocuments';
import { uiCount, uiDate, uiDocumentCitationSection, uiDocumentFilename, uiIdentifier, uiJoin, uiLabel, type UiLabel } from '../../lib/uiCopy';
import { useAuditExternalLinks } from '../../hooks/useAuditExternalLinks';
import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';
import { AppText, Button, Disclosure, Row } from '../ui';

const SPECIFICITY: Record<ProductDocumentAction['specificity'], UiLabel> = {
  'exact-product': 'Exact product', 'product-variant': 'Product variant', 'product-family': 'Product family',
  'provider-general': 'Shared provider terms', background: 'Background',
  unknown: 'Specificity unknown',
};
const RELEVANCE: Record<NonNullable<ProductSourceDocument['relevance']>, UiLabel> = {
  verified: 'Verified', conditional: 'Conditional', supplementary: 'Supplementary', candidate: 'Unverified', superseded: 'Superseded',
};
const RETRIEVAL: Record<NonNullable<ProductSourceDocument['verification']>, UiLabel> = {
  'declared-reference': 'Declared', 'discovery-candidate': 'Candidate', pending: 'Pending', failed: 'Failed', deferred: 'Deferred', captured: 'Captured',
};
function DocumentRow({ action }: { action: ProductDocumentAction }) {
  const [citationPage, setCitationPage] = useState(0);
  const { requestExternalUrl } = useTrustedExternalUrl();
  const doc = action.document;
  const locators = [...new Map((doc.citations ?? []).filter(citation => citation.page || citation.section || citation.sourcePath)
    .map(citation => [JSON.stringify([citation.page, citation.section, citation.sourcePath]), citation])).values()];
  const selectedCitationPage = Math.min(citationPage, Math.max(0, Math.ceil(locators.length / 8) - 1));
  return <View style={{ gap: 4 }}>
    <AppText variant="small" weight="600">{uiDocumentFilename(doc)}</AppText>
    <AppText variant="small" weight="600">{uiJoin(SPECIFICITY[action.specificity], ' · ', RELEVANCE[action.relevance])}</AppText>
    <AppText variant="small">{uiJoin('Document type', ': ', uiIdentifier(doc.documentType || doc.relation))}</AppText>
    <AppText variant="tiny">{uiJoin('Retrieval', ': ', doc.verification && RETRIEVAL[doc.verification] ? RETRIEVAL[doc.verification] : 'Unknown')}</AppText>
    <AppText variant="tiny">{uiJoin('Checked', ': ', doc.checkedAt ? uiDate(doc.checkedAt) : uiLabel('Unknown'))}</AppText>
    {doc.capturedAt ? <AppText variant="tiny">{uiJoin('Captured', ': ', uiDate(doc.capturedAt))}</AppText> : null}
    {doc.effectiveFrom || doc.effectiveTo ? <AppText variant="tiny">{uiJoin('Effective from', ': ', uiDate(doc.effectiveFrom), ' · ', 'Effective to', ': ', uiDate(doc.effectiveTo))}</AppText> : null}
    {locators.slice(selectedCitationPage * 8, (selectedCitationPage + 1) * 8).map((citation, index) => <AppText key={index} variant="tiny">{uiJoin(
      citation.page ? uiJoin('Page', ' ', uiCount(citation.page)) : null,
      citation.section ? uiJoin(' · ', uiDocumentCitationSection(citation)) : null,
      citation.sourcePath ? uiJoin(' · ', uiIdentifier(citation.sourcePath)) : null)}</AppText>)}
    {locators.length > 8 ? <Row style={{ gap: 8 }}>
      <Button title="Previous page" variant="secondary" disabled={selectedCitationPage === 0} onPress={() => setCitationPage(selectedCitationPage - 1)} />
      <Button title="Next page" variant="secondary" disabled={(selectedCitationPage + 1) * 8 >= locators.length} onPress={() => setCitationPage(selectedCitationPage + 1)} />
    </Row> : null}
    <Row><Button title={action.specificity === 'background' ? 'Provider website' : 'Open document'} variant="secondary" disabled={!action.url}
      onPress={() => { if (action.url) requestExternalUrl({ url: action.url, purpose: 'lender_source', label: 'Source', page: action.page }); }} /></Row>
    {!action.url ? <AppText variant="tiny">{uiLabel('Unavailable')}</AppText> : null}
  </View>;
}
export function ProductDocuments({ productDetails }: { productDetails: ProductDetail | null | undefined }) {
  const [open, setOpen] = useState(false), [page, setPage] = useState(0);
  const actions = productDocumentActions(productDetails);
  const selectedPage = Math.min(page, Math.max(0, Math.ceil(actions.length / 12) - 1));
  useAuditExternalLinks(actions.flatMap(action => action.url ? [{ url: action.url, purpose: 'lender_source' as const, label: 'Source' }] : []));
  return <Disclosure title="Documents" open={open} onToggle={() => setOpen(value => !value)}><View style={{ gap: 12 }}>
    <AppText variant="small">{uiJoin('Sources', ' · ', uiCount(actions.length))}</AppText>
    {actions.length ? actions.slice(selectedPage * 12, (selectedPage + 1) * 12).map((action, index) => <DocumentRow key={`${selectedPage}:${index}`} action={action} />)
      : <AppText variant="small">{uiLabel('Unavailable')}</AppText>}
    {actions.length > 12 ? <Row style={{ gap: 8 }}>
      <Button title="Previous page" variant="secondary" disabled={selectedPage === 0} onPress={() => setPage(selectedPage - 1)} />
      <Button title="Next page" variant="secondary" disabled={(selectedPage + 1) * 12 >= actions.length} onPress={() => setPage(selectedPage + 1)} />
    </Row> : null}
  </View></Disclosure>;
}
