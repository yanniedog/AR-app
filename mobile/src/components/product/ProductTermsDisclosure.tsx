import { ProductPageLink } from './ProductPageLink';
import { ProductDocuments } from './ProductDocuments';
import { termsSourceDocuments } from '../../data/productDocuments';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../../data/store';
import { type ProductTerms } from '../../data/productTerms';
import { previousTermsReference, type TermsReference } from '../../data/termsReferenceStore';
import { loadProductTerms } from '../../data/productTermsTransport';
import { AppText, Button, Disclosure } from '../ui';
import { useAuditExternalLinks } from '../../hooks/useAuditExternalLinks';
import { CustomerProfilePanel } from '../CustomerProfilePanel';
import { FinancialFactRows } from './FinancialFactRows';
import { uiTermRevisionValue } from '../../lib/productTermsUiFacts';
import { uiDate, uiIdentifier, uiJoin, uiLabel } from '../../lib/uiCopy';
function EvidenceRows({ terms }: { terms: ProductTerms }) {
  const [termsOpen, setTermsOpen] = useState(false), [changesOpen, setChangesOpen] = useState(false);
  useAuditExternalLinks(terms.documents.map(document => ({ url: document.source_url, purpose: 'lender_source', label: 'Source' })));
  return <View style={{ gap: 12 }}>
    <ProductDocuments productDetails={{ sourceDocuments: termsSourceDocuments(terms) }} />
    <Disclosure title="Terms" open={termsOpen} onToggle={() => setTermsOpen(!termsOpen)}><View style={{ gap: 12 }}>
      {terms.revisions.map(revision => <View key={revision.term_revision_id} style={{ gap: 4 }}>
        <AppText variant="small" weight="600">{uiIdentifier(revision.parameter_key)}</AppText>
        <ProductPageLink label={uiJoin(uiIdentifier(revision.parameter_key), ', ', uiTermRevisionValue(revision))}><AppText variant="small">{uiTermRevisionValue(revision)}</AppText></ProductPageLink>
        <FinancialFactRows linkToProduct rows={[{ label: 'Tier', value: uiIdentifier(revision.applicability.tier) }, { label: 'Package', value: uiIdentifier(revision.applicability.package) }, { label: 'Customer group', value: uiIdentifier(revision.applicability.cohort) },
          { label: 'Effective from', value: uiDate(revision.applicability.effective_from) }, { label: 'Effective to', value: uiDate(revision.applicability.effective_to) }, { label: 'Observed', value: uiDate(revision.observed_at) }]} />
      </View>)}
    </View></Disclosure>
    <Disclosure title="Changes" open={changesOpen} onToggle={() => setChangesOpen(!changesOpen)}><View style={{ gap: 8 }}>
      {terms.changes.map(change => { const before = terms.revisions.find(r => r.term_revision_id === change.before_revision_id), after = terms.revisions.find(r => r.term_revision_id === change.after_revision_id);
        const parameters = [...new Set([before?.parameter_key, after?.parameter_key].filter((key): key is string => key !== undefined))];
        return <View key={change.term_change_id} style={{ gap: 4 }}><AppText variant="small" weight="600">{uiJoin(change.kind === 'added' ? 'Added' : change.kind === 'removed' ? 'Removed' : change.kind === 'extraction_corrected' ? 'Extraction corrected' : 'Changed', ' · ', uiDate(change.observed_at))}</AppText>
          <FinancialFactRows linkToProduct rows={[{ label: 'Field', value: parameters.length ? uiJoin(...parameters.flatMap((parameter, index) => [index ? uiLabel(' → ') : null, uiIdentifier(parameter)])) : uiLabel('Unavailable') },
            { label: 'Prior revision', value: before ? uiTermRevisionValue(before) : uiLabel(change.before_revision_id ? 'Unavailable' : 'Not applicable') }, { label: 'Next revision', value: after ? uiTermRevisionValue(after) : uiLabel(change.after_revision_id ? 'Unavailable' : 'Not applicable') }]} />
        </View>; })}
    </View></Disclosure>
  </View>;
}
export function ProductTermsDisclosure({ productKey }: { productKey: string }) {
  const manifest = useStore(state => state.manifest); const [open, setOpen] = useState(false), [priorOpen, setPriorOpen] = useState(false), [retry, setRetry] = useState(0);
  const [prior, setPrior] = useState<{ identity: string; reference: TermsReference | null } | null>(null);
  const identity = `${manifest?.payload_revision?.bundle_sha256 ?? ''}:${manifest?.files.terms_index?.sha256 ?? ''}:${productKey}`;
  const [result, setResult] = useState<{ identity: string; terms?: ProductTerms | null; failed?: boolean } | null>(null), selected = result?.identity === identity ? result : null;
  useEffect(() => {
    if (!open || !manifest) return; let active = true; setResult(null); setPrior(null); setPriorOpen(false);
    void previousTermsReference(productKey, manifest.payload_revision?.bundle_sha256 ?? '', manifest.files.terms_index?.sha256).then(reference => { if (active) setPrior({ identity, reference }); });
    void loadProductTerms(manifest, productKey).then(terms => { if (active) setResult({ identity, terms }); }, () => { if (active) setResult({ identity, failed: true }); });
    return () => { active = false; };
  }, [identity, manifest, open, productKey, retry]);
  const hasAsset = Boolean(manifest?.files.terms_index);
  const reference = prior?.identity === identity ? prior.reference : null;
  return <Disclosure title="Terms" open={open} onToggle={() => setOpen(!open)}>
    <CustomerProfilePanel productKey={productKey} />
    <AppText variant="small" color="textMuted">{uiJoin('Eligibility unverified', ' · ', 'Fees unverified')}</AppText>
    {selected?.terms ? <EvidenceRows terms={selected.terms} /> : selected?.failed ? <View style={{ gap: 8 }}><AppText variant="small">{uiLabel("Unverified")}</AppText><Button title="Retry" variant="secondary" onPress={() => setRetry(retry + 1)} /></View> : <AppText variant="small" color="textMuted">{uiLabel(hasAsset && !selected ? 'Loading' : 'Unavailable')}</AppText>}
    {!selected?.terms && selected && reference ? <Disclosure title="Cached" open={priorOpen} onToggle={() => setPriorOpen(!priorOpen)}>
      <AppText variant="small">{uiJoin('Cached', ' · ', 'Unverified', ' · ', uiDate(reference.runDate))}</AppText>
      <EvidenceRows terms={reference.terms} />
    </Disclosure> : null}
  </Disclosure>;
}
