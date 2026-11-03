import fs from 'node:fs';
import path from 'node:path';
import { createObservedPopulationAdoption } from '../src/data/observedPopulationAdoption';
import { OBSERVED_POPULATION_CAPABILITY as capability, OBSERVED_POPULATION_INDEX_URL, observedPopulationTransportUrl } from '../src/data/observedPopulationChannel';
import { verifiedDetailsSha } from '../src/data/detailsIdentity';
import { getSuitabilityIndex } from '../src/data/suitabilityIndex';
import type { AppState, StoreSet } from '../src/data/storeTypes';
import { DEFAULT_PREFS } from '../src/data/storeTypes';
import { cache } from '../src/data/cache';
import { evaluateAppHealthDataQuality } from '../src/lib/appHealth/dataQuality';
import { CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT } from '../src/lib/appHealth/sourceContract';
import { candidateFixture, codec, hash, memoryStorage } from '../testUtils/observedPopulation';

function store() {
  let state = { manifest: null, core: null, details: null, activeSection: 'Mortgage',
    historyBanks: { old: true }, productHistory: { old: true },
    prefs: { ...DEFAULT_PREFS, calc: { ...DEFAULT_PREFS.calc, loanBalance: '650000' },
      profileFilters: { ...DEFAULT_PREFS.profileFilters, loanPurposes: ['Owner occupied'] } },
    savedRates: [{ schemaVersion: 1, id: 'product:preserve-me', scope: 'product', productKey: 'preserve-me',
      rateIndex: null, savedAt: '2026-11-02T14:00:00Z', savedRate: null }] } as unknown as AppState;
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
function privateFixture(fixturePath: string) {
  const directory = path.resolve(fixturePath);
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
  return { directory, manifestText, manifest, transport };
}

(fixtureDirectory ? test : test.skip)('authentic producer fixture preserves bytes and fails full adoption on missing required manifest metadata', async () => {
  const { directory, manifestText, manifest, transport } = privateFixture(fixtureDirectory!);
  const { storage, files } = memoryStorage(), state = store();
  const adoption = createObservedPopulationAdoption(capability, storage, codec, transport, state.set, state.get, '1.0.258');
  const previous = state.get();
  expect(manifest.generated_at).toBeUndefined(); expect(manifest.schedule).toBeUndefined();
  await expect(adoption.refresh()).rejects.toThrow('required manifest generated_at/schedule/app_min_version');
  expect(state.get()).toBe(previous); expect(files.size).toBe(0);
  expect(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8')).toBe(manifestText);
}, 60_000);

const completeFixtureDirectory = process.env.AR_OBSERVED_COMPLETE_FIXTURE_DIR;
(completeFixtureDirectory ? test : test.skip)('authentic r2 adopts and restores exact assets with partial facts and rejects cache corruption', async () => {
  const { directory, manifestText, manifest, transport } = privateFixture(completeFixtureDirectory!);
  const before = new Map(fs.readdirSync(directory).map(name => [name, hash(fs.readFileSync(path.join(directory, name)))]));
  expect(hash(Buffer.from(manifestText))).toBe('1e171689f3e0a3492ed748ffcd41b31fe79c3f33c94051120190cf6aa8767281');
  const { storage, files } = memoryStorage(), state = store(), user = state.get();
  const legacyWrite = jest.spyOn(cache, 'writeSuitabilityIndex').mockRejectedValue(Error('Legacy write forbidden'));
  try {
    const adoption = createObservedPopulationAdoption(capability, storage, codec, transport, state.set, state.get, '1.0.258');
    await expect(adoption.refresh()).resolves.toBe(true);
    const live = state.get();
    expect(live.manifest).toEqual(manifest);
    expect(live.core?.coverage?.population_assessment).toMatchObject({ scope: 'observed-products', total_population: null,
      missing_product_count: null, observed_counts: { products: 2795, rates: 16117, providers: 103 } });
    expect(live).toMatchObject({ source: 'remote', offline: false, coreAssetState: { status: 'partial' } });
    expect(live.core?.run_date).toBe('2026-11-03'); expect(live.details?.run_date).toBe('2026-11-03');
    expect(verifiedDetailsSha(live.details!)).toBe(manifest.files.details.sha256);
    expect(getSuitabilityIndex()).toMatchObject({ coreSha: manifest.files.core.sha256, detailsSha: manifest.files.details.sha256 });
    for (const key of ['prefs', 'savedRates', 'activeSection'] as const) expect(live[key]).toBe(user[key]);
    expect(live.prefs.calc.loanBalance).toBe('650000');
    expect(live.prefs.profileFilters.loanPurposes).toEqual(['Owner occupied']);
    for (const key of ['core', 'details']) {
      const persisted = [...files].find(([name]) => name.endsWith(`/${key}.bin`))?.[1];
      expect(persisted).toBeDefined(); expect(hash(persisted!)).toBe(manifest.files[key].sha256);
    }
    const audit = adoption.auditSnapshot();
    expect(evaluateAppHealthDataQuality(audit.snapshot, audit.contract).find(check => check.code === 'manifest-contract')?.status).toBe('pass');
    const persistedBefore = [...files].map(([name, bytes]) => [name, hash(bytes)]);
    expect((await adoption.readLiveAudit()).snapshot.manifest).toEqual(manifest);
    expect(state.get()).toBe(live); expect([...files].map(([name, bytes]) => [name, hash(bytes)])).toEqual(persistedBefore);
    // A fresh owner must restore solely from persisted bytes, without using the network.
    const offline = store();
    const unavailable = { readText: async () => { throw Error('Offline'); }, readBytes: async () => { throw Error('Offline'); } };
    const restored = createObservedPopulationAdoption(capability, storage, codec, unavailable, offline.set, offline.get, '1.0.258');
    await expect(restored.restore()).resolves.toBe(true);
    expect(offline.get()).toMatchObject({ source: 'cache', offline: true, coreAssetState: { status: 'partial' } });
    expect(offline.get().core?.coverage?.population_assessment).toEqual(live.core?.coverage?.population_assessment);
    const visible = offline.get(), eligibility = getSuitabilityIndex();
    await expect(restored.refresh()).rejects.toThrow('Offline');
    expect(offline.get()).toBe(visible); expect(getSuitabilityIndex()).toBe(eligibility);
    const coreKey = [...files.keys()].find(name => name.endsWith('/core.bin'))!;
    const corrupted = files.get(coreKey)!.slice(); corrupted[0] ^= 1; files.set(coreKey, corrupted);
    await expect(restored.restore()).rejects.toThrow('core hash');
    expect(offline.get()).toBe(visible); expect(getSuitabilityIndex()).toBe(eligibility);
    expect(legacyWrite).not.toHaveBeenCalled();
    for (const [name, digest] of before) expect(hash(fs.readFileSync(path.join(directory, name)))).toBe(digest);
  } finally { legacyWrite.mockRestore(); }
}, 60_000);
