import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { prepareMortgageResultsIndex, type MortgageResultsIndex } from '../data/mortgageResultsIndex';
import type { PublicCatalogueView } from '../data/publicRateIntegration';
import { getMandatoryEligibilityRevision, subscribeMandatoryEligibility } from '../data/eligibilityGate';
import { getSuitabilityRevision, subscribeSuitabilityGate } from '../data/suitabilityGate';
import type { RateConditionContext } from '../data/rateConditions';
import type { RateRow } from '../types';
import { scheduleAfterInteractions } from '../lib/yieldToUi';

/** Completed indexes outlive a Rates remount. Every identity that a fresh
 * preparation would read is part of the key; validity is rechecked on reuse. */
const REUSE_LIMIT = 2;
type ReuseKey = readonly unknown[];
const completed: { key: ReuseKey; index: MortgageResultsIndex }[] = [];
const sameKey = (a: ReuseKey, b: ReuseKey) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
function reusableIndex(key: ReuseKey): MortgageResultsIndex | null {
  const now = Date.now();
  const at = completed.findIndex(item => sameKey(item.key, key));
  if (at < 0) return null;
  const { index } = completed[at];
  if (now >= index.from && now < index.until) return index;
  // Expiry and clock rollback are irreversible for a retained entry: a later
  // clock change back into the window must not revive expired quotes.
  completed.splice(at, 1);
  return null;
}
function retainIndex(key: ReuseKey, index: MortgageResultsIndex) {
  const at = completed.findIndex(item => sameKey(item.key, key));
  if (at >= 0) completed.splice(at, 1);
  completed.push({ key, index });
  while (completed.length > REUSE_LIMIT) completed.shift();
}
/** Test seam: drop reusable indexes between isolated cases. */
export function clearReusableMortgageIndexes() { completed.length = 0; }

/** Prepare immutable quotes, source scopes and sort orders before filter taps.
 * Source replacement, gate revision and temporal boundaries fail closed. */
export function useMortgageResultsIndex(source: readonly RateRow[], catalogue: PublicCatalogueView,
  context: RateConditionContext, includeNonStandard: boolean, revision: number, enabled: boolean) {
  const mandatoryRevision = useSyncExternalStore(subscribeMandatoryEligibility,
    getMandatoryEligibilityRevision, getMandatoryEligibilityRevision);
  const suitabilityRevision = useSyncExternalStore(subscribeSuitabilityGate,
    getSuitabilityRevision, getSuitabilityRevision);
  const [clock, setClock] = useState(0);
  const owner = useMemo(() => ({ source, catalogue, context, includeNonStandard, revision, clock, mandatoryRevision, suitabilityRevision }),
    [source, catalogue, context, includeNonStandard, revision, clock, mandatoryRevision, suitabilityRevision]);
  const reuseKey = useMemo(() => [source, catalogue, context.core, context.details, context.manifest, context.coreIntegrity,
    includeNonStandard, revision, mandatoryRevision, suitabilityRevision] as const,
  [source, catalogue, context.core, context.details, context.manifest, context.coreIntegrity, includeNonStandard, revision, mandatoryRevision, suitabilityRevision]);
  const [snapshot, setSnapshot] = useState<{ owner: typeof owner; index: MortgageResultsIndex | null; error: boolean } | null>(null);
  const current = snapshot?.owner === owner;
  const expired = !!(current && snapshot?.index && (Date.now() < snapshot.index.from || Date.now() >= snapshot.index.until));
  const reused = current ? null : reusableIndex(reuseKey);
  const index = current && snapshot.index && Date.now() >= snapshot.index.from && Date.now() < snapshot.index.until ? snapshot.index : reused;
  const hasReuse = reused != null;
  useEffect(() => {
    if (!enabled || catalogue.status !== 'unavailable' && (catalogue.status !== 'ready' || !catalogue.allLoaded) || current || hasReuse) return;
    let cancelled = false;
    const cancel = scheduleAfterInteractions(() => {
      void prepareMortgageResultsIndex({ source, catalogue, context, includeNonStandard, cancelled: () => cancelled })
        .then(index => {
          if (cancelled) return;
          if (index) retainIndex(reuseKey, index);
          setSnapshot({ owner, index, error: false });
        })
        .catch(() => { if (!cancelled) setSnapshot({ owner, index: null, error: true }); });
    });
    return () => { cancelled = true; cancel(); };
  }, [enabled, catalogue, source, context, includeNonStandard, owner, current, hasReuse, reuseKey]);
  useEffect(() => {
    if (enabled && expired) setClock(value => value + 1);
  }, [enabled, expired]);
  useEffect(() => {
    if (!enabled || !index || !Number.isFinite(index.until)) return;
    const timer = setTimeout(() => setClock(value => value + 1), Math.max(1, index.until - Date.now()));
    (timer as ReturnType<typeof setTimeout> & { unref?: () => void }).unref?.();
    return () => clearTimeout(timer);
  }, [enabled, index]);
  return { index, status: index ? 'ready' as const : expired || !current ? 'preparing' as const
    : snapshot.error ? 'error' as const : 'unsupported' as const };
}
