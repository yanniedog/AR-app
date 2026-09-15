import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { verifiedCatalogueDetails } from '../data/detailsCatalogue';
/** One request per adopted source identity. Retry is explicit; shared ensure coalesces callers. */
export function useDetailsCatalogue() {
  const core = useStore(s => s.core), integrity = useStore(s => s.coreIntegrity), manifest = useStore(s => s.manifest), details = useStore(s => s.details), loading = useStore(s => s.detailsLoading), ensure = useStore(s => s.ensureDetails);
  const identity = JSON.stringify([manifest?.payload_revision?.bundle_sha256, manifest?.run_date, manifest?.files.core.sha256, manifest?.files.details.sha256]);
  const [attempted, setAttempted] = useState<string | null>(null), [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setAttempted(null);
    void ensure({ forProductView: true, ...(retry ? { force: true } : {}) }).catch(() => undefined).then(() => { if (active) setAttempted(identity); });
    return () => { active = false; };
  }, [ensure, identity, core, integrity, retry]);
  return { core, manifest, details: verifiedCatalogueDetails(core, integrity, manifest, details), loading: !!loading || attempted !== identity,
    retry: useCallback(() => setRetry(value => value + 1), []) };
}
