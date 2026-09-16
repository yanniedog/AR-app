import React, { useEffect, useState } from 'react';
import { useStore } from '../../data/store';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import type { RateRow, SectionKey } from '../../types';
import { loadActivitySelections, type ActivitySelection, type ActivityTarget } from '../../data/activityContracts/transport';
import { AppText, Button, Disclosure } from '../ui';
import { ActivityPeriodForm } from './ActivityPeriodForm';
export function ActivityPeriodCalculation({ productKey, row, section }: { productKey: string; row?: RateRow; section?: SectionKey }) {
  const manifest = useStore(s => s.manifest), core = useStore(s => s.core), coreIntegrity = useStore(s => s.coreIntegrity), details = useStore(s => s.details), ensureDetails = useStore(s => s.ensureDetails);
  const [open, setOpen] = useState(false), [retry, setRetry] = useState(0), identity = hashText(canonical([manifest, productKey, row ?? null, section ?? null]));
  const [loaded, setLoaded] = useState<{ identity: string; core: typeof core; details: typeof details; integrity: typeof coreIntegrity; selections?: ActivitySelection[]; target?: ActivityTarget; error?: string } | null>(null);
  const current = loaded?.identity === identity && loaded.core === core && loaded.details === details && loaded.integrity === coreIntegrity ? loaded : null;
  useEffect(() => {
    if (!open) return; let active = true;
    const save = (value: Partial<NonNullable<typeof loaded>>) => { if (active) setLoaded({ identity, core, details, integrity: coreIntegrity, ...value }); };
    const detail = details && Object.hasOwn(details.products, productKey) ? details.products[productKey] : null;
    if (!detail || row && section !== 'Savings') { save({ error: 'A verified savings product is needed.' }); return; }
    const target: ActivityTarget = row ? { kind: 'rate_variant', productKey, detail, section: 'Savings', row } : { kind: 'product', productKey, detail };
    void loadActivitySelections({ manifest, core, coreIntegrity, details }, target).then(selections => save({ selections, target }), () => save({ error: 'Reviewed savings policies could not be verified for this publication.' }));
    return () => { active = false; };
  }, [open, retry, identity, manifest, core, coreIntegrity, details, productKey, row, section]);
  if (row && section !== 'Savings') return null;
  return <Disclosure title="Calculate savings with a prior-activity bonus" summary="Reviewed policies only" open={open} onToggle={() => setOpen(!open)}>
    {!current ? <AppText variant="small">Checking savings policies...</AppText> : current.selections?.length && current.target ? <ActivityPeriodForm key={identity} selections={current.selections} context={{ manifest, core, coreIntegrity, details }} target={current.target} /> : <><AppText variant="small">{current.error ?? 'A reviewed savings calculation is unavailable for this product in this publication.'}</AppText><Button title="Retry savings policies" variant="secondary" onPress={() => void ensureDetails({ forProductView: true }).catch(() => undefined).finally(() => setRetry(r => r + 1))} /></>}
  </Disclosure>;
}
