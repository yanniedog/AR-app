import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { RateRow } from '../../types';
import type { ProductTerms, TermRevision } from '../../data/productTerms';
import { loadProductTerms } from '../../data/productTermsTransport';
import { canonicalTermsComparison } from '../../data/canonicalTermsComparison';
import { useStore } from '../../data/store';
import { AppText, Button, Disclosure } from '../ui';
import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';

function RevisionCell({ terms, revisions }: { terms: ProductTerms; revisions: TermRevision[] }) {
  const { requestExternalUrl } = useTrustedExternalUrl();
  return <View style={{ gap: 6 }}>
    {revisions.length > 1 && <AppText variant="small">Multiple revisions in this scope; no single value selected.</AppText>}
    {revisions.map(revision => <View key={revision.term_revision_id} style={{ gap: 4 }}>
      <AppText variant="small">{typeof revision.value === 'string' ? revision.value : JSON.stringify(revision.value)} {revision.unit ?? '(unit unknown)'}</AppText>
      <AppText variant="tiny">Interpretation: {revision.status}. Observed {revision.observed_at}. This does not establish calculation approval.</AppText>
      {revision.clause_ids.map(id => {
        const clause = terms.clauses.find(item => item.clause_id === id), document = terms.documents.find(item => item.document_version_id === clause?.document_version_id);
        return clause ? <View key={id}><AppText variant="small">{clause.text}</AppText>{document && <Button title="Open source" variant="secondary" onPress={() => requestExternalUrl({ url: document.source_url, label: revision.parameter_key, purpose: 'lender_source' })} />}</View> : null;
      })}
    </View>)}
  </View>;
}
export function CanonicalTermsComparison({ rows }: { rows: RateRow[] }) {
  const manifest = useStore(s => s.manifest), [open, setOpen] = useState(false), [retry, setRetry] = useState(0), [limit, setLimit] = useState(30), [expanded, setExpanded] = useState<string | null>(null);
  const products = [...new Map(rows.map(row => [row.product_key, row])).values()];
  const identity = JSON.stringify([manifest?.payload_revision?.bundle_sha256, manifest?.files.terms_index?.sha256, products.map(row => row.product_key)]);
  const [loaded, setLoaded] = useState<{ identity: string; values: { productKey: string; terms: ProductTerms | null; failed: boolean }[] } | null>(null);
  const current = loaded?.identity === identity ? loaded : null;
  useEffect(() => {
    if (!open || !manifest) return; let active = true; setLoaded(null); setLimit(30); setExpanded(null);
    void Promise.all(products.map(row => loadProductTerms(manifest, row.product_key).then(terms => ({ productKey: row.product_key, terms, failed: false }), () => ({ productKey: row.product_key, terms: null, failed: true })))).then(values => { if (active) setLoaded({ identity, values }); });
    return () => { active = false; };
    // Product identities, rather than freshly allocated array objects, own this request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, identity, manifest, retry]);
  const groups = current ? canonicalTermsComparison(current.values) : [];
  return <Disclosure title="Compare scoped document terms" summary="Exact parameter keys and applicability" open={open} onToggle={() => setOpen(!open)}>
    <AppText variant="small">Only exact parameter, unit and known scope identifiers align. Missing terms remain unknown; different scopes stay separate. Rates and eligibility are not recalculated here.</AppText>
    {!current ? <AppText variant="small">{manifest ? 'Loading verified terms...' : 'Document terms unavailable.'}</AppText> : <>
      {current.values.filter(item => !item.terms).map(item => <AppText key={item.productKey} variant="small">{products.find(row => row.product_key === item.productKey)?.product_name}: {item.failed ? 'Current terms could not be verified.' : 'Canonical terms not reported.'}</AppText>)}
      {current.values.some(item => item.failed) && <Button title="Retry document terms" variant="secondary" onPress={() => setRetry(retry + 1)} />}
      {!groups.length && <AppText variant="small">No canonical comparison rows available.</AppText>}
      {groups.slice(0, limit).map(group => <Disclosure key={group.key} title={group.parameterKey} open={expanded === group.key} onToggle={() => setExpanded(expanded === group.key ? null : group.key)}>
        <AppText variant="small">Unit: {group.unit ?? 'unknown'}. Tier: {group.scope.tier ?? 'unknown'}. Package: {group.scope.package ?? 'unknown'}. Group: {group.scope.cohort ?? 'unknown'}.</AppText>
        <AppText variant="small">Effective {group.scope.effective_from ?? 'unknown'} to {group.scope.effective_to ?? 'unknown'}.</AppText>
        {products.map(row => { const terms = current.values.find(item => item.productKey === row.product_key)?.terms, revisions = group.cells[row.product_key]; return <View key={row.product_key} style={{ gap: 4 }}>
          <AppText weight="700">{row.provider}: {row.product_name}</AppText>
          {terms && revisions ? <RevisionCell terms={terms} revisions={revisions} /> : <AppText variant="small">Unknown in this exact scope.</AppText>}
        </View>; })}
      </Disclosure>)}
      {groups.length > limit && <Button title={`Show more terms (${groups.length - limit} remaining)`} variant="secondary" onPress={() => setLimit(limit + 30)} />}
    </>}
  </Disclosure>;
}
