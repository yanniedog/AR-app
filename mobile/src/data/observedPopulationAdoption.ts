import type { StoreGet, StoreSet } from './storeTypes';
import { bindVerifiedDetails } from './detailsIdentity';
import { buildSuitabilityIndex, clearSuitabilityIndex, installSuitabilityIndex } from './suitabilityIndex';
import { cachedAssetStateForProviderCoverage, liveAssetStateForProviderCoverage } from './assetState';
import { createObservedPopulationAssets, type CandidateAssetCodec, type CandidateAssetStorage, type CandidateAssetTransport,
  type CandidateEdition } from './observedPopulationAssets';
import { assertNoRevisionRollback } from './payloadRevision';
import { observedPopulationAuditEvidence } from './observedPopulationAudit';

/** Explicit activation seam; shipping startup/refresh does not call this until hosted isolation is proven. */
export function createObservedPopulationAdoption(capability: unknown, storage: CandidateAssetStorage,
  codec: CandidateAssetCodec, transport: CandidateAssetTransport, set: StoreSet, get: StoreGet, appVersion: string) {
  const assets = createObservedPopulationAssets(capability, storage, codec, appVersion);
  let request = 0, active: AbortController | null = null;
  let current: CandidateEdition | null = null;
  const adopt = async (edition: CandidateEdition, offline: boolean, token: number, owner: ReturnType<StoreGet>['manifest']) => {
    const manifest = edition.selection.manifest;
    const details = bindVerifiedDetails(edition.details, manifest.files.details.sha256);
    const index = await buildSuitabilityIndex(edition.core, details, manifest.files.details.sha256, manifest.files.core.sha256);
    if (token !== request || get().manifest !== owner) throw Error('Candidate adoption superseded');
    assertNoRevisionRollback(get().manifest, manifest);
    // No await between eligibility installation and the matching core/details state transaction.
    clearSuitabilityIndex(); installSuitabilityIndex(index);
    set({ core: edition.core, coreIntegrity: edition.integrity, details, manifest,
      coreAssetState: (offline ? cachedAssetStateForProviderCoverage : liveAssetStateForProviderCoverage)(edition.integrity, edition.core.coverage),
      source: offline ? 'cache' : 'remote', offline, status: 'ready', error: null, refreshing: false,
      postRefreshWarming: false, detailsLoading: false, payloadProgress: null, pendingIngestRunDate: null,
      bankRateHistoryLoading: false, bankRateHistoryRevision: (get().bankRateHistoryRevision ?? 0) + 1,
      searchIndex: null, searchIndexStatus: 'idle', searchIndexError: null,
      historyBanks: null, historyBanksError: null, bankInsights: null, bankInsightsError: null,
      bankSpreadHistory: null, bankSpreadHistoryError: null, productHistory: null, productHistoryError: null,
      rbaCalendar: null, rbaCalendarSha: null, rbaCalendarError: null,
    });
    current = edition;
    return true;
  };
  return {
    async refresh() {
      const token = ++request; active?.abort(); const abort = new AbortController(); active = abort;
      const owner = get().manifest;
      try {
        const edition = await assets.refresh(transport, owner, abort.signal, () => token === request && get().manifest === owner);
        return await adopt(edition, false, token, owner);
      } finally { if (active === abort) active = null; }
    },
    async restore() {
      const token = ++request; active?.abort(); active = null; const owner = get().manifest;
      const edition = await assets.restore(owner);
      return edition ? adopt(edition, true, token, owner) : false;
    },
    cancel() { request++; active?.abort(); active = null; },
    auditSnapshot() {
      if (!current || get().manifest !== current.selection.manifest) throw Error('Candidate snapshot is no longer current');
      return observedPopulationAuditEvidence(current, get().offline ? 'cache' : 'remote', appVersion);
    },
    async readLiveAudit(signal?: AbortSignal) {
      return observedPopulationAuditEvidence(await assets.readLive(transport, get().manifest, signal), 'remote', appVersion);
    },
  };
}
