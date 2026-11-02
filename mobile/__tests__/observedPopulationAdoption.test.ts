import fs from 'node:fs';
import path from 'node:path';
import { createObservedPopulationAdoption } from '../src/data/observedPopulationAdoption';
import { OBSERVED_POPULATION_CAPABILITY as capability, OBSERVED_POPULATION_INDEX_URL, observedPopulationTransportUrl } from '../src/data/observedPopulationChannel';
import { verifiedDetailsSha } from '../src/data/detailsIdentity';
import { getSuitabilityIndex } from '../src/data/suitabilityIndex';
import type { AppState, StoreSet } from '../src/data/storeTypes';
import { cache } from '../src/data/cache';
import { evaluateAppHealthDataQuality } from '../src/lib/appHealth/dataQuality';
import { CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT } from '../src/lib/appHealth/sourceContract';
import { candidateFixture, codec, memoryStorage } from '../testUtils/observedPopulation';

function store() {
  let state = { manifest: null, core: null, details: null, activeSection: 'Mortgage',
    filters: { loanAmount: 650000, lvr: 72 }, historyBanks: { old: true }, productHistory: { old: true },
    prefs: { includeNonStandard: false }, savedRates: ['preserve-me'] } as unknown as AppState;
  const set = ((patch: Partial<AppState>) => { state = { ...state, ...patch }; }) as StoreSet;
  return { set, get: () => state };
}

test('adopts verified matching core/details/eligibility together and preserves user inputs', async () => {
  const f = candidateFixture(), { storage } = memoryStorage(), state = store();
  const legacyWrite = jest.spyOn(cache, 'writeSuitabilityIndex').mockRejectedValue(Error('Legacy write forbidden'));
  const adoption = createObservedPopulationAdoption(capability, storage, codec, f.transport, state.set, state.get, '1.0.258');
  const user = state.get(); await adoption.refresh();
  const live = state.get();
  expect(live.coreAssetState.status).toBe('partial'); expect(live.source).toBe('remote');
  expect(live.core?.run_date).toBe(live.details?.run_date);
  expect(verifiedDetailsSha(live.details!)).toBe(f.manifest.files.details.sha256);
  expect(getSuitabilityIndex()).toMatchObject({ coreSha: f.manifest.files.core.sha256, detailsSha: f.manifest.files.details.sha256 });
  expect(live.prefs).toBe(user.prefs); expect(live.savedRates).toBe(user.savedRates);
  expect(live.activeSection).toBe(user.activeSection);
  expect(live.historyBanks).toBeNull(); expect(live.productHistory).toBeNull();
  expect(legacyWrite).not.toHaveBeenCalled();
  const audit = adoption.auditSnapshot();
  const checks = evaluateAppHealthDataQuality(audit.snapshot, audit.contract);
  expect(checks.find(check => check.code === 'manifest-contract')?.status).toBe('pass');
  expect(evaluateAppHealthDataQuality(audit.snapshot, CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT)
    .find(check => check.code === 'manifest-contract')?.status).toBe('fail');
  const visible = state.get(), persisted = storage.write;
  const writes = jest.spyOn(storage, 'write');
  expect((await adoption.readLiveAudit()).snapshot.manifest).toEqual(f.manifest);
  expect(state.get()).toBe(visible); expect(writes).not.toHaveBeenCalled(); storage.write = persisted;
  await adoption.restore();
  expect(state.get()).toMatchObject({ source: 'cache', offline: true, coreAssetState: { status: 'partial' } });
  legacyWrite.mockRestore();
});

test('failed refresh keeps the visible edition and its eligibility index intact', async () => {
  const f = candidateFixture(), { storage } = memoryStorage(), state = store();
  const adoption = createObservedPopulationAdoption(capability, storage, codec, f.transport, state.set, state.get, '1.0.258');
  await adoption.refresh(); const visible = state.get(), index = getSuitabilityIndex();
  f.transport.readBytes = async () => { throw Error('Network unavailable'); };
  await expect(adoption.refresh()).rejects.toThrow('Network unavailable');
  expect(state.get()).toBe(visible); expect(getSuitabilityIndex()).toBe(index);
});

test('cancelled slow refresh cannot replace state after a newer request', async () => {
  const f = candidateFixture(), { storage } = memoryStorage(), state = store();
  const read = f.transport.readBytes;
  let release!: () => void; const block = new Promise<void>(resolve => { release = resolve; });
  let first = true;
  f.transport.readBytes = async request => { if (first) { first = false; await block; } return read(request); };
  const adoption = createObservedPopulationAdoption(capability, storage, codec, f.transport, state.set, state.get, '1.0.258');
  const old = adoption.refresh(); await new Promise(resolve => setTimeout(resolve, 0));
  await adoption.refresh(); const current = state.get(); release();
  await expect(old).rejects.toThrow('cancelled'); expect(state.get()).toBe(current);
});

// The authentic bytes stay private; CI uses synthetic cases above. Local acceptance supplies this directory explicitly.
const fixtureDirectory = process.env.AR_OBSERVED_FIXTURE_DIR;
(fixtureDirectory ? test : test.skip)('authentic producer fixture preserves bytes and fails full adoption on missing required manifest metadata', async () => {
  const directory = path.resolve(fixtureDirectory!);
  const indexText = fs.readFileSync(path.join(directory, 'dates-index.json'), 'utf8');
  const manifestText = fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  const index = JSON.parse(indexText);
  const transport = {
    async readText({ url }: { url: string }) {
      if (url === observedPopulationTransportUrl(OBSERVED_POPULATION_INDEX_URL, capability)) return indexText;
      if (url === observedPopulationTransportUrl(index.revision_heads[index.latest_date].manifest_url, capability)) return manifestText;
      throw Error('Unexpected URL');
    },
    async readBytes({ url }: { url: string }) {
      const file = Object.values(manifest.files).find((file: any) => observedPopulationTransportUrl(file.url, capability) === url) as { name: string };
      if (!file || !/^[\w.-]+$/.test(file.name) || file.name.includes('..')) throw Error('Invalid fixture file');
      return new Uint8Array(fs.readFileSync(path.join(directory, file.name)));
    },
  };
  const { storage, files } = memoryStorage(), state = store();
  const adoption = createObservedPopulationAdoption(capability, storage, codec, transport, state.set, state.get, '1.0.258');
  const previous = state.get();
  expect(manifest.generated_at).toBeUndefined(); expect(manifest.schedule).toBeUndefined();
  await expect(adoption.refresh()).rejects.toThrow('required manifest generated_at/schedule/app_min_version');
  expect(state.get()).toBe(previous); expect(files.size).toBe(0);
  expect(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8')).toBe(manifestText);
}, 60_000);
