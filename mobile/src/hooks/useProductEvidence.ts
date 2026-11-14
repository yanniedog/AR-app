import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../data/store';
import type { EvidenceLane } from '../data/productEvidencePublication';
import { EvidenceError } from '../data/productEvidenceWire';
import { loadProductEvidenceDocument, releaseProductEvidenceDocument, type ProductEvidenceDocument, type ProductEvidenceOutcome } from '../data/productEvidenceDocument';
import { claimEvidenceUi } from '../data/productEvidenceUiLease';

type State = ProductEvidenceOutcome | { status: 'idle' | 'loading' | 'paused' | 'failed' };
export function useProductEvidence(productKey: string, lane: EvidenceLane, open: boolean, retry: number, bodySha?: string) {
  const manifest = useStore(s => s.manifest), core = useStore(s => s.core), coreIntegrity = useStore(s => s.coreIntegrity);
  const details = useStore(s => s.details), head = useStore(s => s.productEvidenceHead), source = useStore(s => s.source);
  const context = useMemo(() => ({ manifest, core, coreIntegrity, details, productEvidenceHead: head, source }), [manifest, core, coreIntegrity, details, head, source]);
  const [result, setResult] = useState<{ identity: string; context: typeof context; state: State } | null>(null);
  const identity = `${manifest?.payload_revision?.bundle_sha256 ?? ''}:${productKey}:${lane}:${bodySha ?? ''}`;
  useEffect(() => {
    if (!open) { setResult(null); return; }
    const controller = new AbortController(); let active = true;
    let retained: ProductEvidenceDocument | null = null;
    const discard = () => { if (retained) releaseProductEvidenceDocument(retained); retained = null; };
    const lease = claimEvidenceUi(() => { controller.abort(); discard(); if (active) setResult({ identity, context, state: { status: 'paused' } }); });
    const isCurrent = () => {
      const live = useStore.getState();
      return active && lease.current() && !controller.signal.aborted && live.manifest === manifest && live.core === core
        && live.coreIntegrity === coreIntegrity && live.details === details && live.productEvidenceHead === head && live.source === source;
    };
    setResult({ identity, context, state: { status: 'loading' } });
    // Yield before integrity checks; never hash the current core during rendering.
    void new Promise<void>(resolve => setTimeout(resolve, 0)).then(() => {
      if (!isCurrent()) throw new EvidenceError('cancelled', 'Evidence selection changed');
      return loadProductEvidenceDocument(context, productKey, lane, isCurrent, controller.signal, bodySha);
    }).then(state => {
      if (state.status === 'observed') retained = state.document;
      if (isCurrent()) setResult({ identity, context, state }); else discard();
    }, error => {
      if (isCurrent()) setResult({ identity, context, state: { status: error instanceof EvidenceError && error.code === 'unsupported' ? 'unsupported' : 'failed' } });
    }).finally(() => { if (!retained || controller.signal.aborted) { discard(); lease.release(); } });
    return () => { active = false; try { controller.abort(); discard(); } finally { lease.release(); } };
  }, [manifest, core, coreIntegrity, details, head, source, productKey, lane, open, retry, identity, bodySha, context]);
  return open && result?.identity === identity && result.context === context ? result.state : { status: 'idle' as const };
}
