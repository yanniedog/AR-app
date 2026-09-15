import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useStore } from '../../data/store';
import { TERMS_STAGES, type ProductTerms, type TermsStage } from '../../data/productTerms';
import { previousTermsReference, type TermsReference } from '../../data/termsReferenceStore';
import { loadProductTerms } from '../../data/productTermsTransport';
import { humanizeEnum } from '../../data/format';
import { AppText, Button, Disclosure } from '../ui';
import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';
import { CustomerProfilePanel } from '../CustomerProfilePanel';

const STAGE_LABELS: Record<TermsStage, string> = {
  discovery: 'Sources identified', acquisition: 'Documents captured', extraction: 'Text extracted',
  interpretation: 'Terms interpreted', calculation: 'Calculation coverage',
};

function EvidenceRows({ terms }: { terms: ProductTerms }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const { requestExternalUrl } = useTrustedExternalUrl();
  return (
    <View style={{ gap: 12 }}>
      {TERMS_STAGES.map((stage) => {
        const coverage = terms.coverage[stage];
        return <AppText key={stage} variant="small">
          {STAGE_LABELS[stage]}: {humanizeEnum(coverage.status)} · {coverage.observed}{coverage.expected === null ? ' (total unknown)' : ` / ${coverage.expected}`}
        </AppText>;
      })}
      {terms.coverage.gaps.map((gap, index) => <AppText key={index} variant="small" color="textMuted">{gap}</AppText>)}
      <Disclosure title="Source evidence" summary={`${terms.documents.length} documents · ${terms.clauses.length} source excerpts`} open={sourcesOpen} onToggle={() => setSourcesOpen(!sourcesOpen)}>
        <View style={{ gap: 12 }}>
          {terms.documents.map((document) => <View key={document.document_version_id} style={{ gap: 4 }}>
            <Button title={new URL(document.source_url).hostname} variant="secondary" onPress={() => requestExternalUrl({ url: document.source_url, purpose: 'lender_source', label: 'Product document' })} />
            <AppText variant="tiny" color="textMuted">Observed {document.observed_at} · Effective {document.effective_from ?? 'date unknown'}</AppText>
            {terms.clauses.filter((clause) => clause.document_version_id === document.document_version_id).map((clause) => <View key={clause.clause_id}>
              <AppText variant="small">{clause.text}</AppText>
              <AppText variant="tiny" color="textMuted">{clause.locator.page ? `Page ${clause.locator.page} · ` : ''}{clause.locator.section ?? ''} {clause.excerpt_truncated ? 'Excerpt shortened · ' : ''}{humanizeEnum(clause.disposition)}</AppText>
              {clause.reason ? <AppText variant="tiny">{clause.reason}</AppText> : null}
            </View>)}
          </View>)}
        </View>
      </Disclosure>
      <Disclosure title="Verified terms" summary={`${terms.revisions.length} revisions`} open={termsOpen} onToggle={() => setTermsOpen(!termsOpen)}>
        <View style={{ gap: 12 }}>
          {terms.revisions.map((revision) => <View key={revision.term_revision_id}>
            <AppText variant="small" weight="700">{humanizeEnum(revision.parameter_key)}</AppText>
            <AppText variant="small">{typeof revision.value === 'string' ? revision.value : JSON.stringify(revision.value)} {revision.unit ?? ''}</AppText>
            <AppText variant="tiny" color="textMuted">Tier: {revision.applicability.tier ?? 'unknown'} · Package: {revision.applicability.package ?? 'unknown'} · Customer group: {revision.applicability.cohort ?? 'unknown'}</AppText>
            <AppText variant="tiny" color="textMuted">Effective: {revision.applicability.effective_from ?? 'unknown'} to {revision.applicability.effective_to ?? 'unknown'} · Observed: {revision.observed_at}</AppText>
            {terms.clauses.filter((clause) => revision.clause_ids.includes(clause.clause_id)).map((clause) =>
              <AppText key={clause.clause_id} variant="small" color="textMuted">Source{clause.locator.page ? `, page ${clause.locator.page}` : ''}: {clause.text}</AppText>)}
          </View>)}
        </View>
      </Disclosure>
      <Disclosure title="Terms changes" summary={`${terms.changes.length} recorded`} open={changesOpen} onToggle={() => setChangesOpen(!changesOpen)}>
        <View style={{ gap: 8 }}>{terms.changes.map((change) => {
          const before = terms.revisions.find((revision) => revision.term_revision_id === change.before_revision_id);
          const after = terms.revisions.find((revision) => revision.term_revision_id === change.after_revision_id);
          const value = (revision: typeof before, id: string | null) => id === null ? 'None' : revision
            ? `${humanizeEnum(revision.parameter_key)}: ${typeof revision.value === 'string' ? revision.value : JSON.stringify(revision.value)} ${revision.unit ?? ''}`
            : 'Earlier revision not included in this edition';
          return <View key={change.term_change_id}>
            <AppText variant="small" weight="700">{humanizeEnum(change.kind)} · Observed {change.observed_at}</AppText>
            <AppText variant="small">Before: {value(before, change.before_revision_id)}</AppText>
            <AppText variant="small">After: {value(after, change.after_revision_id)}</AppText>
          </View>;
        })}</View>
      </Disclosure>
    </View>
  );
}

export function ProductTermsDisclosure({ productKey }: { productKey: string }) {
  const manifest = useStore((state) => state.manifest);
  const [open, setOpen] = useState(false);
  const [prior, setPrior] = useState<{ identity: string; reference: TermsReference | null } | null>(null);
  const [priorOpen, setPriorOpen] = useState(false);
  const [retry, setRetry] = useState(0);
  const identity = `${manifest?.payload_revision?.bundle_sha256 ?? ''}:${manifest?.files.terms_index?.sha256 ?? ''}:${productKey}`;
  const [result, setResult] = useState<{ identity: string; terms?: ProductTerms | null; error?: string } | null>(null);
  const selected = result?.identity === identity ? result : null;
  useEffect(() => {
    if (!open || !manifest) return;
    let active = true;
    setResult(null); setPrior(null); setPriorOpen(false);
    void previousTermsReference(productKey, manifest.payload_revision?.bundle_sha256 ?? '', manifest.files.terms_index?.sha256).then(reference => { if (active) setPrior({ identity, reference }); });
    void loadProductTerms(manifest, productKey).then(
      (terms) => { if (active) setResult({ identity, terms }); },
      () => { if (active) setResult({ identity, error: 'Document evidence could not be verified.' }); },
    );
    return () => { active = false; };
  }, [identity, manifest, open, productKey, retry]);
  const hasAsset = !!manifest?.files.terms_index;
  return (
    <Disclosure title="Document coverage and terms" summary={hasAsset ? 'Open to check evidence and changes' : 'Document analysis not yet reported'} open={open} onToggle={() => setOpen(!open)}>
      <CustomerProfilePanel productKey={productKey} />
      {selected?.terms ? <EvidenceRows terms={selected.terms} /> : selected?.error ? <View style={{ gap: 8 }}><AppText variant="small">{selected.error}</AppText><Button title="Retry" variant="secondary" onPress={() => setRetry(retry + 1)} /></View> :
        <AppText variant="small" color="textMuted">{hasAsset && !selected ? 'Loading document evidence…' : 'Complete document capture and interpretation have not been established for this product.'}</AppText>}
      {!selected?.terms && selected && prior?.identity === identity && prior.reference && <Disclosure title="Saved descriptive evidence" open={priorOpen} onToggle={() => setPriorOpen(!priorOpen)}>
        <AppText variant="small">{prior.reference.edition === manifest?.payload_revision?.bundle_sha256 && prior.reference.indexSha256 === manifest.files.terms_index?.sha256 ? 'Saved evidence from this publication' : 'Earlier publication'} {prior.reference.runDate}. This saved reference was not reverified by this request and is not calculation approval.</AppText>
        <AppText variant="tiny">Edition {prior.reference.edition}</AppText>
        <EvidenceRows terms={prior.reference.terms} />
      </Disclosure>}
    </Disclosure>
  );
}
