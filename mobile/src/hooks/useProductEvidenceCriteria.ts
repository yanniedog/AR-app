import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../data/store';
import { type CriteriaQuery } from '../data/productEvidenceCriteria';
import { loadProductCriteria, type CriteriaColumn } from '../data/productEvidenceCriteriaDocument';
import { claimEvidenceUi } from '../data/productEvidenceUiLease';
import { EvidenceError } from '../data/productEvidenceWire';

type State = { status: 'idle' | 'loading' | 'paused' | 'failed' | 'unsupported' } | { status: 'ready'; columns: CriteriaColumn[] };
export function useProductEvidenceCriteria(productKeys: readonly string[], query: CriteriaQuery, open: boolean, retry: number): State {
  const manifest = useStore(s => s.manifest), core = useStore(s => s.core), coreIntegrity = useStore(s => s.coreIntegrity);
  const details = useStore(s => s.details), head = useStore(s => s.productEvidenceHead), source = useStore(s => s.source);
  const context = useMemo(() => ({ manifest, core, coreIntegrity, details, productEvidenceHead: head, source }), [manifest, core, coreIntegrity, details, head, source]);
  const keysIdentity = JSON.stringify(productKeys), queryIdentity = JSON.stringify(query), identity = `${keysIdentity}:${queryIdentity}:${retry}`;
  const [result, setResult] = useState<{ context: typeof context; identity: string; state: State } | null>(null);
  useEffect(() => {
    if (!open) { setResult(null); return; }
    let active = true; const controller = new AbortController();
    const lease = claimEvidenceUi(() => { controller.abort(); if (active) setResult({ context, identity, state: { status: 'paused' } }); });
    const isCurrent = () => { const live = useStore.getState(); return active && lease.current() && !controller.signal.aborted &&
      live.manifest === manifest && live.core === core && live.coreIntegrity === coreIntegrity && live.details === details && live.productEvidenceHead === head && live.source === source; };
    const timer = setTimeout(() => { controller.abort(); if (active && lease.current()) setResult({ context, identity, state: { status: 'failed' } }); }, 300_000);
    setResult({ context, identity, state: { status: 'loading' } });
    void Promise.resolve().then(() => loadProductCriteria(context, JSON.parse(keysIdentity) as string[], JSON.parse(queryIdentity) as CriteriaQuery,
      isCurrent, controller.signal)).then(columns => { if (isCurrent()) setResult({ context, identity, state: { status: 'ready', columns } }); }, error => {
      if (isCurrent()) setResult({ context, identity, state: { status: error instanceof EvidenceError && error.code === 'unsupported' ? 'unsupported' : 'failed' } });
    }).finally(() => { clearTimeout(timer); lease.release(); });
    return () => { active = false; try { controller.abort(); } finally { clearTimeout(timer); lease.release(); } };
  }, [context, identity, keysIdentity, queryIdentity, manifest, core, coreIntegrity, details, head, source, open]);
  return open && result?.context === context && result.identity === identity ? result.state : { status: 'idle' };
}
