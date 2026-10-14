import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { RateRow } from '../../types';
import type { ProductTerms, TermRevision } from '../../data/productTerms';
import { loadProductTerms } from '../../data/productTermsTransport';
import { canonicalTermsComparison } from '../../data/canonicalTermsComparison';
import { useStore } from '../../data/store';
import { AppText, Button, Disclosure } from '../ui';
import { uiCount, uiDate, uiIdentifier, uiJoin, uiLabel, uiProductName, uiProviderName } from '../../lib/uiCopy';
import { uiCanonicalTermValue } from './engineComparisonUi';
import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';
import { useAuditExternalLinks } from '../../hooks/useAuditExternalLinks';

function RevisionCell({ terms, revisions }: { terms: ProductTerms; revisions: TermRevision[] }) {
  const { requestExternalUrl } = useTrustedExternalUrl();
  useAuditExternalLinks(revisions.flatMap((revision) => revision.clause_ids.flatMap((id) => {
    const clause = terms.clauses.find((item) => item.clause_id === id);
    const document = terms.documents.find((item) => item.document_version_id === clause?.document_version_id);
    return document ? [{ url: document.source_url, label: uiIdentifier(revision.parameter_key), purpose: 'lender_source' as const }] : [];
  })));
  return <View style={{ gap: 6 }}>
    {revisions.length > 1 && <AppText variant="small">{uiJoin('Revisions', ' · ', uiCount(revisions.length), ' · ', 'Source review required')}</AppText>}
    {revisions.map(revision => <View key={revision.term_revision_id} style={{ gap: 4 }}>
      <AppText variant="small">{uiJoin(uiCanonicalTermValue(revision), ' · ', 'Unit', ' · ', uiIdentifier(revision.unit))}</AppText>
      <AppText variant="tiny">{uiJoin('Status', ' · ', 'Verified', ' · ', 'Observed', ' · ', uiDate(revision.observed_at), ' · ', 'No approval')}</AppText>
      {revision.clause_ids.map(id => {
        const clause = terms.clauses.find(item => item.clause_id === id), document = terms.documents.find(item => item.document_version_id === clause?.document_version_id);
        return clause ? <View key={id}><AppText variant="small">{uiJoin('Source review required', ' · ', uiIdentifier(clause.clause_id))}</AppText>{document && <Button title="Open source" variant="secondary" onPress={() => requestExternalUrl({ url: document.source_url, label: uiIdentifier(revision.parameter_key), purpose: 'lender_source' })} />}</View> : null;
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
  return <Disclosure title="Compare terms and conditions" open={open} onToggle={() => setOpen(!open)}>
    <AppText variant="small">{uiJoin('Basis', ' · ', 'Exact scope', ' · ', 'Eligibility unverified')}</AppText>
    {!current ? <AppText variant="small">{uiLabel(manifest ? 'Loading' : 'Unavailable')}</AppText> : <>
      {current.values.filter(item => !item.terms).map(item => <AppText key={item.productKey} variant="small">{uiJoin(uiProductName({ product_name: products.find(row => row.product_key === item.productKey)?.product_name ?? item.productKey }), ' · ', item.failed ? 'Unverified' : 'Unknown')}</AppText>)}
      {current.values.some(item => item.failed) && <Button title="Retry" variant="secondary" onPress={() => setRetry(retry + 1)} />}
      {!groups.length && <AppText variant="small">{uiLabel('No results')}</AppText>}
      {groups.slice(0, limit).map(group => <Disclosure key={group.key} title={uiIdentifier(group.parameterKey)} open={expanded === group.key} onToggle={() => setExpanded(expanded === group.key ? null : group.key)}>
        <AppText variant="small">{uiJoin('Unit', ' · ', uiIdentifier(group.unit), ' · ', 'Tier', ' · ', uiIdentifier(group.scope.tier), ' · ', 'Package', ' · ', uiIdentifier(group.scope.package), ' · ', 'Group', ' · ', uiIdentifier(group.scope.cohort))}</AppText>
        <AppText variant="small">{uiJoin('Effective from', ' · ', uiDate(group.scope.effective_from), ' · ', 'Effective to', ' · ', uiDate(group.scope.effective_to))}</AppText>
        {products.map(row => { const terms = current.values.find(item => item.productKey === row.product_key)?.terms, revisions = group.cells[row.product_key]; return <View key={row.product_key} style={{ gap: 4 }}>
          <AppText weight="700">{uiJoin(uiProviderName(row), ' · ', uiProductName(row))}</AppText>
          {terms && revisions ? <RevisionCell terms={terms} revisions={revisions} /> : <AppText variant="small">{uiLabel('Unknown')}</AppText>}
        </View>; })}
      </Disclosure>)}
      {groups.length > limit && <Button title={uiJoin('More', ' · ', uiCount(groups.length - limit))} variant="secondary" onPress={() => setLimit(limit + 30)} />}
    </>}
  </Disclosure>;
}
