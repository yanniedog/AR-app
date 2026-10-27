import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { prepareMortgageResultsIndex, type MortgageResultsIndex } from '../data/mortgageResultsIndex';
import type { PublicCatalogueView } from '../data/publicRateIntegration';
import { getMandatoryEligibilityRevision, subscribeMandatoryEligibility } from '../data/eligibilityGate';
import { getSuitabilityRevision, subscribeSuitabilityGate } from '../data/suitabilityGate';
import type { RateConditionContext } from '../data/rateConditions';
import type { RateRow } from '../types';
import { scheduleAfterInteractions } from '../lib/yieldToUi';

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
  const [snapshot, setSnapshot] = useState<{ owner: typeof owner; index: MortgageResultsIndex | null; error: boolean } | null>(null);
  const current = snapshot?.owner === owner;
  const expired = !!(current && snapshot?.index && (Date.now() < snapshot.index.from || Date.now() >= snapshot.index.until));
  const index = current && snapshot.index && Date.now() >= snapshot.index.from && Date.now() < snapshot.index.until ? snapshot.index : null;
  useEffect(() => {
    if (!enabled || catalogue.status !== 'ready' || !catalogue.allLoaded || current) return;
    let cancelled = false;
    const cancel = scheduleAfterInteractions(() => {
      void prepareMortgageResultsIndex({ source, catalogue, context, includeNonStandard, cancelled: () => cancelled })
        .then(index => { if (!cancelled) setSnapshot({ owner, index, error: false }); })
        .catch(() => { if (!cancelled) setSnapshot({ owner, index: null, error: true }); });
    });
    return () => { cancelled = true; cancel(); };
  }, [enabled, catalogue, source, context, includeNonStandard, owner, current]);
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
