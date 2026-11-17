import { useCallback, useEffect, useState } from 'react';
import type { Manifest, ProductDetail } from '../types';
import { acquireProductCriteria, type CriteriaLookup } from '../data/productCriteriaTransport';
import { yieldToUi } from '../lib/yieldToUi';
import { projectProductCriteria } from '../data/productCriteriaProjection';

/** The sidecar augments a local selector view; it never mutates hash-bound
 * details or grants the augmented object a transport identity. */
export function useProductCriteria(manifest: Manifest | null, details: Record<string, ProductDetail> | null | undefined, enabled: boolean) {
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const [result, setResult] = useState<{ manifest: Manifest; details: typeof details; lookup?: CriteriaLookup; status: 'loading' | 'ready' | 'failed' } | null>(null);
  const selected = result?.manifest === manifest && result.details === details ? result : null;
  const available = Boolean(manifest && (manifest.files as Record<string, unknown>).product_criteria_index);
  useEffect(() => {
    if (!enabled || !available || !manifest || selected?.status === 'ready') return;
    let active = true; const lease = acquireProductCriteria(manifest);
    setResult({ manifest, details, status: 'loading' });
    void lease.promise.then(async products => {
      const lookup: CriteriaLookup = Object.create(null);
      const keys = new Set([...Object.keys(details ?? {}), ...Object.keys(products)]);
      let count = 0;
      for (const key of keys) {
        if (++count % 16 === 0) { await yieldToUi(0); if (!active) return; }
        const legacy = details?.[key], descriptive = products[key];
        lookup[key] = !descriptive ? legacy! : projectProductCriteria(legacy, descriptive);
      }
      if (active) setResult({ manifest, details, status: 'ready', lookup });
    }, () => { if (active) setResult({ manifest, details, status: 'failed' }); })
      .catch(() => { if (active) setResult({ manifest, details, status: 'failed' }); })
      .finally(lease.release);
    return () => { active = false; lease.release(); };
  }, [enabled, available, manifest, details, selected?.status === 'ready', attempt]);
  return { lookup: selected?.lookup ?? details, retry, status: !available ? 'unavailable' as const : selected?.status ?? 'idle' as const };
}
