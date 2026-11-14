import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useProductEvidence } from '../../hooks/useProductEvidence';
import { useStore } from '../../data/store';
import type { EvidenceLane } from '../../data/productEvidencePublication';
import { productEvidencePage, type ProductEvidenceDocument, type ProductEvidenceBodyChoice } from '../../data/productEvidenceDocument';
import { uiCount, uiDate, uiIdentifier, uiJoin, uiLabel, type UiLabel } from '../../lib/uiCopy';
import { AppText, Button, Disclosure, Row } from '../ui';
import { ProductEvidenceText } from '../ProductEvidenceText';
import { ProductEvidenceCriteria } from './ProductEvidenceCriteria';

function EvidencePages({ document }: { document: ProductEvidenceDocument }) {
  const [record, setRecord] = useState(0), [page, setPage] = useState(0);
  const selected = useMemo(() => productEvidencePage(document, record, page), [document, record, page]);
  const recordAt = (next: number) => { setRecord(next); setPage(0); };
  return <View style={{ gap: 10 }}>
    <AppText variant="small">{uiJoin('Observed', ' · ', uiDate(document.observedDate), ' · ',
      document.observationState === 'partial' ? 'Partial' : document.observationState === 'failed' ? 'Unverified' : 'Observed')}</AppText>
    <AppText variant="small" color="textMuted">{uiJoin('Coverage', ' · ', 'Unverified', ' · ', 'Calculation', ' · ', 'No approval')}</AppText>
    <AppText variant="small">{uiJoin('Status', ' · ', document.availability === 'available' ? 'Ready' : 'Unknown')}</AppText>
    {document.responseState && document.responseState !== 'matched' ? <AppText variant="small">{uiLabel(document.responseState === 'ambiguous' ? 'Ambiguous'
      : document.responseState === 'index_only' ? 'Index only' : 'Source review required')}</AppText> : null}
    {document.facts !== null ? <>
      <AppText variant="small">{uiJoin('Product facts', ' · ', uiCount(document.facts), ' · ', uiCount(record + 1), ' / ', uiCount(document.records))}</AppText>
      <Row style={{ gap: 8, flexWrap: 'wrap' }}><Button title="First fact" disabled={record === 0} onPress={() => recordAt(0)} variant="secondary" />
        <Button title="Previous fact" disabled={record === 0} onPress={() => recordAt(record - 1)} variant="secondary" />
        <Button title="Next fact" disabled={record + 1 >= document.records} onPress={() => recordAt(record + 1)} variant="secondary" />
        <Button title="Last fact" disabled={record + 1 >= document.records} onPress={() => recordAt(document.records - 1)} variant="secondary" /></Row>
    </> : <AppText variant="tiny">{uiJoin(document.bodyRole === 'index' ? 'Product index' : 'Product detail', ' · ',
      'Reference', ' · ', uiIdentifier(document.bodySha256), ' · ', document.bodyMatchesExport ? 'Matching' : 'Unverified')}</AppText>}
    <AppText variant="small">{uiJoin('Page', ' · ', uiCount(page + 1), ' / ', uiCount(selected.pages), ' · ', 'Characters', ' · ', uiCount(selected.start), '–', uiCount(selected.end), ' / ', uiCount(selected.characters))}</AppText>
    <Row style={{ gap: 8, flexWrap: 'wrap' }}><Button title="First page" disabled={page === 0} onPress={() => setPage(0)} variant="secondary" />
      <Button title="Previous page" disabled={page === 0} onPress={() => setPage(page - 1)} variant="secondary" />
      <Button title="Next page" disabled={page + 1 >= selected.pages} onPress={() => setPage(page + 1)} variant="secondary" />
      <Button title="Last page" disabled={page + 1 >= selected.pages} onPress={() => setPage(selected.pages - 1)} variant="secondary" /></Row>
    <ProductEvidenceText page={selected} />
  </View>;
}
function ResponseChoices({ choices, open }: { choices: ProductEvidenceBodyChoice[]; open: (sha: string) => void }) {
  const [choice, setChoice] = useState(0), selected = choices[Math.min(choice, choices.length - 1)];
  if (!selected) return null;
  return <View style={{ gap: 8 }}><AppText variant="small">{uiJoin('Responses', ' · ', uiCount(choice + 1), ' / ', uiCount(choices.length), ' · ',
    selected.role === 'index' ? 'Product index' : 'Product detail', ' · ', 'Export match', ' · ', selected.matchesExport ? 'Matching' : 'Unverified')}</AppText>
    <AppText variant="tiny">{uiIdentifier(selected.sha256)}</AppText>
    <Row style={{ gap: 8, flexWrap: 'wrap' }}><Button title="First response" variant="secondary" disabled={choice === 0} onPress={() => setChoice(0)} />
      <Button title="Previous response" variant="secondary" disabled={choice === 0} onPress={() => setChoice(choice - 1)} />
      <Button title="Next response" variant="secondary" disabled={choice + 1 >= choices.length} onPress={() => setChoice(choice + 1)} />
      <Button title="Last response" variant="secondary" disabled={choice + 1 >= choices.length} onPress={() => setChoice(choices.length - 1)} /></Row>
    <Button title="Open response" variant="secondary" onPress={() => open(selected.sha256)} />
  </View>;
}
export function ProductEvidenceDisclosure({ productKey }: { productKey: string }) {
  const [open, setOpen] = useState(false), [lane, setLane] = useState<EvidenceLane>('product_evidence_v1'), [retry, setRetry] = useState(0);
  const bundle = useStore(state => state.manifest?.payload_revision?.bundle_sha256 ?? '');
  const identity = `${bundle}:${productKey}`;
  const alive = useRef(true), checking = useRef(false);
  const [update, setUpdate] = useState<{ identity: string; state: 'loading' | 'failed' | 'idle' } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const refresh = () => {
    if (checking.current) return;
    checking.current = true; setUpdate({ identity, state: 'loading' });
    // Ordinary selected-edition refresh; never retries a producer operation or
    // discovers a capability outside the validated immutable manifest.
    void Promise.resolve().then(() => useStore.getState().refresh({ manual: true })).then(() => {
      if (alive.current) setUpdate({ identity, state: 'idle' });
    }, () => { if (alive.current) setUpdate({ identity, state: 'failed' }); }).finally(() => { checking.current = false; });
  };
  const updateState = update?.identity === identity ? update.state : 'idle';
  const [selectedBody, setSelectedBody] = useState<{ identity: string; sha256: string } | null>(null);
  const state = useProductEvidence(productKey, lane, open, retry, selectedBody?.identity === identity ? selectedBody.sha256 : undefined);
  const producerFailure = state.status === 'failed' && 'reason' in state && Boolean(state.reason);
  const status: UiLabel = state.status === 'loading' || state.status === 'idle' ? 'Loading' : state.status === 'unsupported' ? 'Unsupported'
    : state.status === 'pending' ? 'Pending' : state.status === 'disabled' ? 'Disabled' : producerFailure ? 'Failed'
    : state.status === 'unavailable' ? 'Unavailable' : state.status === 'paused' ? 'Paused'
    : state.status === 'unknown' ? state.routeState === 'ambiguous' ? 'Ambiguous' : state.routeState === 'index_only' ? 'Index only'
    : state.routeState === 'projection_unverified' ? 'Source review required' : 'Unknown' : 'Unverified';
  return <><ProductEvidenceCriteria productKeys={[productKey]} /><Disclosure title="Source evidence" open={open} onToggle={() => setOpen(value => !value)}>
    <View style={{ gap: 12 }}>
      <Row style={{ gap: 8 }}><Button title="Product facts" variant="secondary" disabled={lane === 'product_evidence_v1'} onPress={() => setLane('product_evidence_v1')} />
        <Button title="Original response" variant="secondary" disabled={lane === 'product_response_evidence_v1'} onPress={() => setLane('product_response_evidence_v1')} /></Row>
      {'bodies' in state && state.bodies?.length ? <ResponseChoices key={identity} choices={state.bodies} open={sha256 => setSelectedBody({ identity, sha256 })} /> : null}
      {state.status === 'observed' ? <EvidencePages key={lane + state.document.productKey + state.document.edition + state.document.bodySha256 + retry} document={state.document} /> : <>
        <AppText variant="small">{uiLabel(status)}</AppText>
        {(['failed', 'paused', 'unknown'].includes(state.status) && !producerFailure) ? <Button title="Retry" variant="secondary" onPress={() => setRetry(value => value + 1)} /> : null}
        {(state.status === 'pending' || state.status === 'unavailable' || producerFailure) ? <>
          <Button title={updateState === 'loading' ? 'Updating' : 'Refresh'} disabled={updateState === 'loading'} variant="secondary" onPress={refresh} />
          {updateState === 'failed' ? <AppText variant="small">{uiJoin('Refresh', ' · ', 'Failed')}</AppText> : null}
        </> : null}
      </>}
    </View>
  </Disclosure></>;
}
