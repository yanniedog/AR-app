import { MissingPublicPayloadError } from '../lib/automaticDataAccess';
import { isLocalAppHealthAudit } from '../lib/appHealthTransportGuard';
import type { Manifest } from '../types';
import type { AppState } from './storeTypes';
import { samePayloadIdentity } from './payloadRevision';

type RecoveryState = Pick<AppState, 'manifest' | 'source' | 'refreshing' | 'postRefreshWarming' | 'refresh'>;

/** A missing old companion can require a current edition, never ciphertext fallback. */
export function createMissingPublicPayloadRecovery(get: () => RecoveryState) {
  const attempted = new Set<string>();
  let pending: { key: string; manifest: Manifest; retries: Map<string, () => Promise<void>> } | null = null;
  return (error: unknown, manifest: Manifest | null, retry: () => Promise<void>): void => {
    if (!(error instanceof MissingPublicPayloadError) || !manifest || isLocalAppHealthAudit() ||
        !Object.values(manifest.files).some(file => file?.url === error.sourceUrl)) return;
    const state = get();
    if (state.source !== 'remote' || state.manifest !== manifest || state.refreshing || state.postRefreshWarming) return;
    const key = JSON.stringify([manifest.repo, manifest.tag, manifest.run_date,
      manifest.payload_revision?.bundle_sha256, manifest.files.core.sha256, manifest.files.details.sha256]);
    if (pending?.key === key) { pending.retries.set(error.sourceUrl, retry); return; }
    if (attempted.has(key)) return;
    const request = { key, manifest, retries: new Map([[error.sourceUrl, retry]]) };
    pending = request;
    // Refresh may await optional ensures while warming. Do not await it inside
    // the failing ensure, or invoke its retry before that ensure releases ownership.
    setTimeout(() => {
      const current = get();
      if (pending !== request) return;
      pending = null;
      if (current.manifest !== manifest || current.source !== 'remote' || current.refreshing ||
          current.postRefreshWarming || isLocalAppHealthAudit()) return;
      attempted.add(key);
      if (attempted.size > 8) attempted.delete(attempted.values().next().value!);
      void current.refresh({ background: true }).then(async () => {
        const adopted = get();
        if (adopted.source !== 'remote' || !adopted.manifest ||
            (samePayloadIdentity(manifest, adopted.manifest) && manifest.tag === adopted.manifest.tag) ||
            isLocalAppHealthAudit()) return;
        await Promise.allSettled([...request.retries.values()].map(action => action()));
      }).catch(() => undefined);
    }, 0);
  };
}
