import { useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { AppText, Button, Disclosure, Row } from '../ui';
import { useProductEvidenceCriteria } from '../../hooks/useProductEvidenceCriteria';
import { type CriteriaKind } from '../../data/productEvidenceCriteria';
import { type CriteriaColumn } from '../../data/productEvidenceCriteriaDocument';
import { useStore } from '../../data/store';
import { uiCount, uiDate, uiIdentifier, uiJoin, uiLabel, uiProductKeyLabel, useEvidenceCriteriaInput, type UiLabel } from '../../lib/uiCopy';

const KINDS: readonly [CriteriaKind, UiLabel][] = [['all', 'All'], ['fee', 'Fees'], ['eligibility', 'Eligibility'], ['constraint', 'Constraints'],
  ['feature', 'Features'], ['rate', 'Rates'], ['tier', 'Tiers'], ['condition', 'Conditions'], ['attribute', 'Attributes'], ['bundle', 'Bundles']];
const STATUSES: Record<string, UiLabel> = { observed: 'Observed', conditional: 'Conditional', conflicting: 'Conflicting', ambiguous: 'Ambiguous', source_review: 'Unverified',
  unknown: 'Unknown', disabled: 'Disabled', pending: 'Pending', failed: 'Failed', unavailable: 'Not published', unsupported: 'Unsupported' };
function Column({ column, first }: { column: CriteriaColumn; first: boolean }) {
  return <View style={{ width: 300, gap: 8 }}>
    <AppText>{uiLabel(first ? 'Reference product' : 'Exact scope')}</AppText>
    <AppText variant="small">{uiProductKeyLabel(column.productKey)}</AppText>
    {column.status !== 'observed' ? <AppText>{uiLabel(STATUSES[column.status])}</AppText> : <>
      <AppText variant="small">{uiJoin(uiDate(column.observedDate), ' · ', column.observationState === 'partial' ? 'Partial' : column.observationState === 'failed' ? 'Unverified' : 'Observed', ' · ', 'Eligibility unverified')}</AppText>
      <AppText variant="small">{uiJoin('Matching records', ': ', uiCount(column.criteria.matching), ' / ', uiCount(column.criteria.total))}</AppText>
      <AppText variant="small">{uiJoin('Typed records', ': ', uiCount(column.criteria.typed), ' · ', 'Source-only records', ': ', uiCount(column.criteria.unsupported))}</AppText>
      <AppText>{uiLabel(STATUSES[column.criteria.state])}</AppText>
    </>}
  </View>;
}
export function ProductEvidenceCriteria({ productKeys }: { productKeys: readonly string[] }) {
  const [open, setOpen] = useState(false), [retry, setRetry] = useState(0), [kind, setKind] = useState<CriteriaKind>('all');
  const input = useEvidenceCriteriaInput();
  const [applied, setApplied] = useState('');
  const state = useProductEvidenceCriteria(productKeys, { kind, text: applied, record: 0, page: 0 }, open, retry);
  const columns = state.status === 'ready' ? state.columns : [];
  const bundle = useStore(value => value.manifest?.payload_revision?.bundle_sha256 ?? '');
  const identity = JSON.stringify([bundle, productKeys]), alive = useRef(true), refreshing = useRef(false);
  const [update, setUpdate] = useState<{ identity: string; status: 'loading' | 'failed' | 'idle' } | null>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const refresh = () => {
    if (refreshing.current) return;
    refreshing.current = true; setUpdate({ identity, status: 'loading' });
    void Promise.resolve().then(() => useStore.getState().refresh({ manual: true })).then(() => {
      if (alive.current) setUpdate({ identity, status: 'idle' });
    }, () => { if (alive.current) setUpdate({ identity, status: 'failed' }); }).finally(() => { refreshing.current = false; });
  };
  const updateStatus = update?.identity === identity ? update.status : 'idle';
  const canRefresh = columns.some(column => column.status === 'pending' || column.status === 'unavailable' || (column.status === 'failed' && Boolean(column.reason)));
  return <Disclosure title="Source criteria" open={open} onToggle={() => setOpen(value => !value)}><View style={{ gap: 12 }}>
    <AppText>{uiJoin('Selected products only', ' · ', 'Coverage unverified', ' · ', 'Eligibility unverified')}</AppText>
    <TextInput value={input.value} maxLength={256} onChangeText={input.onChangeText} placeholder="Search selected products" accessibilityLabel="Search selected products" />
    <Button title="Search" onPress={() => { setApplied(input.raw); }} variant="secondary" />
    <Row style={{ gap: 8, flexWrap: 'wrap' }}>{KINDS.map(([value, label]) => <Button key={value} title={label} disabled={kind === value}
      onPress={() => { setKind(value); }} variant="secondary" />)}</Row>
    {state.status === 'ready' ? <ScrollView horizontal><Row style={{ gap: 16 }}>{columns.map((column, index) => <Column key={column.productKey} column={column} first={index === 0} />)}</Row></ScrollView>
      : <AppText>{uiLabel(state.status === 'loading' || state.status === 'idle' ? 'Loading' : state.status === 'paused' ? 'Paused' : state.status === 'unsupported' ? 'Unsupported' : 'Failed')}</AppText>}
    {state.status === 'failed' || state.status === 'paused' ? <Button title="Retry" variant="secondary" onPress={() => setRetry(value => value + 1)} /> : null}
    {canRefresh ? <>
      <Button title={updateStatus === 'loading' ? 'Updating' : 'Refresh'} disabled={updateStatus === 'loading'} variant="secondary" onPress={refresh} />
      {updateStatus === 'failed' ? <AppText>{uiJoin('Refresh', ' · ', 'Failed')}</AppText> : null}
    </> : null}
  </View></Disclosure>;
}
