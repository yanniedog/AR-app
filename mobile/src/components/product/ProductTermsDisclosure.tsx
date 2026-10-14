import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../../data/store';
import { TERMS_STAGES, type ProductTerms, type TermsStage } from '../../data/productTerms';
import { previousTermsReference, type TermsReference } from '../../data/termsReferenceStore';
import { loadProductTerms } from '../../data/productTermsTransport';
import { AppText, Button, Disclosure } from '../ui';
import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';
import { useAuditExternalLinks } from '../../hooks/useAuditExternalLinks';
import { CustomerProfilePanel } from '../CustomerProfilePanel';
import { FinancialFactRows } from './FinancialFactRows';
import { uiTermsStageStatus, uiTermRevisionValue } from '../../lib/productTermsUiFacts';
import { uiCount, uiDate, uiIdentifier, uiJoin, uiLabel, type UiLabel } from '../../lib/uiCopy';
import { isValidCalendarDate } from '../../lib/calendarDate';
const STAGE_LABELS: Record<TermsStage, UiLabel> = { discovery: 'Discovery', acquisition: 'Acquisition', extraction: 'Extraction', interpretation: 'Interpretation', calculation: 'Calculation' };
function EvidenceRows({ terms }: { terms: ProductTerms }) {
  const [sourcesOpen, setSourcesOpen] = useState(false), [termsOpen, setTermsOpen] = useState(false), [changesOpen, setChangesOpen] = useState(false);
  const { requestExternalUrl } = useTrustedExternalUrl();
  useAuditExternalLinks(terms.documents.map(document => ({ url: document.source_url, purpose: 'lender_source', label: 'Source' })));
  return <View style={{ gap: 12 }}>
    <FinancialFactRows rows={TERMS_STAGES.map(stage => { const coverage = terms.coverage[stage]; return { label: STAGE_LABELS[stage], value: uiJoin(uiTermsStageStatus(coverage.status), ' · ', uiCount(coverage.observed), ' / ', uiCount(coverage.expected)) }; })} />
    {terms.coverage.gaps.length ? <AppText variant="small" color="warning">{uiJoin('Coverage gaps', ': ', uiCount(terms.coverage.gaps.length), ' · ', 'Source review required')}</AppText> : null}
    <Disclosure title="Sources" open={sourcesOpen} onToggle={() => setSourcesOpen(!sourcesOpen)}><View style={{ gap: 12 }}>
      {terms.documents.map((document, index) => <View key={document.document_version_id} style={{ gap: 4 }}>
        <Button title={uiJoin('Source', ' ', uiCount(index + 1))} variant="secondary" onPress={() => requestExternalUrl({ url: document.source_url, purpose: 'lender_source', label: 'Source' })} />
        <AppText variant="tiny" color="textMuted">{uiJoin('Observed', ' ', uiDate(document.observed_at), ' · ', 'Effective from', ' ', uiDate(document.effective_from), ' · ', 'Effective to', ' ', uiDate(document.effective_to))}</AppText>
        {terms.clauses.filter(clause => clause.document_version_id === document.document_version_id).map(clause => <View key={clause.clause_id} style={{ gap: 2 }}>
          <AppText variant="tiny">{uiJoin('Source', ' ', uiIdentifier(clause.clause_id), clause.locator.page ? uiJoin(' · ', 'Page', ' ', uiCount(clause.locator.page)) : null)}</AppText>
          <AppText variant="tiny" color="textMuted">{uiJoin('Disposition', ': ', clause.disposition === 'interpreted' ? 'Interpreted' : clause.disposition === 'not_applicable' ? 'Not applicable' : 'Uninterpreted', ' · ', 'Source review required')}</AppText>
        </View>)}
      </View>)}
    </View></Disclosure>
    <Disclosure title="Terms" open={termsOpen} onToggle={() => setTermsOpen(!termsOpen)}><View style={{ gap: 12 }}>
      {terms.revisions.map(revision => <View key={revision.term_revision_id} style={{ gap: 4 }}>
        <AppText variant="small" weight="600">{uiIdentifier(revision.parameter_key)}</AppText>
        <AppText variant="small">{uiTermRevisionValue(revision)}</AppText>
        <FinancialFactRows rows={[{ label: 'Tier', value: uiIdentifier(revision.applicability.tier) }, { label: 'Package', value: uiIdentifier(revision.applicability.package) }, { label: 'Customer group', value: uiIdentifier(revision.applicability.cohort) },
          { label: 'Effective from', value: uiDate(revision.applicability.effective_from) }, { label: 'Effective to', value: uiDate(revision.applicability.effective_to) }, { label: 'Observed', value: uiDate(revision.observed_at) }]} />
        {revision.clause_ids.map(id => <AppText key={id} variant="tiny" color="textMuted">{uiJoin('Source', ' ', uiIdentifier(id))}</AppText>)}
      </View>)}
    </View></Disclosure>
    <Disclosure title="Changes" open={changesOpen} onToggle={() => setChangesOpen(!changesOpen)}><View style={{ gap: 8 }}>
      {terms.changes.map(change => { const before = terms.revisions.find(r => r.term_revision_id === change.before_revision_id), after = terms.revisions.find(r => r.term_revision_id === change.after_revision_id);
        return <View key={change.term_change_id} style={{ gap: 4 }}><AppText variant="small" weight="600">{uiJoin(change.kind === 'added' ? 'Added' : change.kind === 'removed' ? 'Removed' : change.kind === 'extraction_corrected' ? 'Extraction corrected' : 'Changed', ' · ', uiDate(change.observed_at))}</AppText>
          <FinancialFactRows rows={[{ label: 'Prior revision', value: before ? uiTermRevisionValue(before) : uiLabel(change.before_revision_id ? 'Unavailable' : 'Not applicable') }, { label: 'Next revision', value: after ? uiTermRevisionValue(after) : uiLabel(change.after_revision_id ? 'Unavailable' : 'Not applicable') }]} />
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
  const referencePublication: UiLabel = !reference || !manifest?.payload_revision?.bundle_sha256 || !manifest.files.terms_index?.sha256 ? 'Unverified'
    : reference.edition === manifest.payload_revision.bundle_sha256 && reference.indexSha256 === manifest.files.terms_index.sha256 ? 'Matching'
    : reference.edition === manifest.payload_revision.bundle_sha256 ? 'Different'
    : !isValidCalendarDate(reference.runDate) || !isValidCalendarDate(manifest.run_date) ? 'Unverified'
    : reference.runDate < manifest.run_date ? 'Earlier' : 'Different';
  return <Disclosure title="Terms" open={open} onToggle={() => setOpen(!open)}>
    <CustomerProfilePanel productKey={productKey} />
    <AppText variant="small" color="textMuted">{uiJoin('Eligibility unverified', ' · ', 'Fees unverified')}</AppText>
    {selected?.terms ? <EvidenceRows terms={selected.terms} /> : selected?.failed ? <View style={{ gap: 8 }}><AppText variant="small">{uiLabel("Unverified")}</AppText><Button title="Retry" variant="secondary" onPress={() => setRetry(retry + 1)} /></View> : <AppText variant="small" color="textMuted">{uiLabel(hasAsset && !selected ? 'Loading' : 'Unavailable')}</AppText>}
    {!selected?.terms && selected && reference ? <Disclosure title="Cached" open={priorOpen} onToggle={() => setPriorOpen(!priorOpen)}>
      <AppText variant="small">{uiJoin('Cached', ' · ', 'Unverified', ' · ', uiDate(reference.runDate))}</AppText><AppText variant="tiny">{uiIdentifier(reference.edition)}</AppText>
      <FinancialFactRows rows={[{ label: 'Publication revision', value: uiLabel(referencePublication) }, { label: 'Calculation', value: uiLabel('No approval') }]} />
      <EvidenceRows terms={reference.terms} />
    </Disclosure> : null}
  </Disclosure>;
}
