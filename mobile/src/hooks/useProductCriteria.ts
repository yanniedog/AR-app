import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Manifest, ProductDetail } from '../types';
import type { CriteriaLookup } from '../data/productCriteriaTransport';
import { acquireProductCriteria } from '../data/productCriteriaAcquisition';
import { yieldToUi } from '../lib/yieldToUi';
import { projectProductCriteria } from '../data/productCriteriaProjection';

/** The sidecar augments a local selector view; it never mutates hash-bound
 * details or grants the augmented object a transport identity. */
export function useProductCriteria(manifest: Manifest | null, details: Record<string, ProductDetail> | null | undefined, enabled: boolean, productKeys?: readonly string[]) {
  const scope = productKeys === undefined ? null : JSON.stringify([...new Set(productKeys)].sort());
  const selection = useMemo(() => scope === null ? undefined : JSON.parse(scope) as string[], [scope]);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const [result, setResult] = useState<{ manifest: Manifest; details: typeof details; scope: typeof scope; lookup?: CriteriaLookup; status: 'loading' | 'ready' | 'failed' } | null>(null);
  const selected = result?.manifest === manifest && result.details === details && result.scope === scope ? result : null;
  const available = Boolean(manifest?.files && (manifest.files as Record<string, unknown>).product_criteria_index);
  useEffect(() => {
    if (!enabled || !available || !manifest || selection?.length === 0 || selected?.status === 'ready') return;
    let active = true; const lease = acquireProductCriteria(manifest, selection);
    setResult({ manifest, details, scope, status: 'loading' });
    void lease.promise.then(async products => {
      const lookup: CriteriaLookup = Object.create(null);
      const keys = new Set(selection ?? [...Object.keys(details ?? {}), ...Object.keys(products)]);
      let count = 0;
      for (const key of keys) {
        if (++count % 16 === 0) { await yieldToUi(0); if (!active) return; }
        const legacy = details?.[key], descriptive = products[key];
        lookup[key] = !descriptive ? legacy! : projectProductCriteria(legacy, descriptive);
      }
      if (active) setResult({ manifest, details, scope, status: 'ready', lookup });
    }, () => { if (active) setResult({ manifest, details, scope, status: 'failed' }); })
      .catch(() => { if (active) setResult({ manifest, details, scope, status: 'failed' }); })
      .finally(lease.release);
    return () => { active = false; lease.release(); };
  }, [enabled, available, manifest, details, scope, selection, selected?.status === 'ready', attempt]);
  return { lookup: selected?.lookup ?? details, retry, status: !available ? 'unavailable' as const : selected?.status ?? 'idle' as const };
}
