import { utf8ToBytes } from '@noble/hashes/utils';
import { createObservedPopulationAssets } from '../src/data/observedPopulationAssets';
import { OBSERVED_POPULATION_CAPABILITY as capability } from '../src/data/observedPopulationChannel';
import { candidateFixture, codec, memoryStorage } from '../testUtils/observedPopulation';

test('downloads and commits exact core/details, restores offline and preserves original observation', async () => {
  const f = candidateFixture(), { storage, files } = memoryStorage();
  const assets = createObservedPopulationAssets(capability, storage, codec, '1.0.258');
  const live = await assets.refresh(f.transport);
  expect(live.core.coverage?.observed_at).toBe('2026-11-02T14:00:00Z');
  expect(files.get('edition-1/core.bin')).toEqual(f.wire.core);
  expect(files.get('edition-1/details.bin')).toEqual(f.wire.details);
  expect([...files.keys()].every(key => /^(head-|edition-)/.test(key))).toBe(true);
  const restored = await createObservedPopulationAssets(capability, storage, codec, '1.0.258').restore();
  expect(restored?.selection.manifestText).toBe(f.text);
  expect(restored?.details).toEqual(f.details);
  expect(restored?.core.coverage?.population_assessment?.total_population).toBeNull();
});

test.each(['core.bin', 'details.bin', 'selection.json', 'head-0.json'])('interrupted %s write leaves previous edition usable', async suffix => {
  const first = candidateFixture(), next = candidateFixture(2), { storage } = memoryStorage();
  const assets = createObservedPopulationAssets(capability, storage, codec, '1.0.258');
  await assets.refresh(first.transport);
  const write = storage.write;
  storage.write = async (key, bytes) => {
    if (key.endsWith(suffix)) { await write(key, bytes.subarray(0, 3)); throw Error('disk interrupted'); }
    return write(key, bytes);
  };
  await expect(assets.refresh(next.transport)).rejects.toThrow();
  expect((await assets.restore())?.selection.manifest.payload_revision?.revision).toBe(1);
});

test('write acknowledgement failure is resolved from the actual committed bytes', async () => {
  const { storage } = memoryStorage(), write = storage.write;
  storage.write = async (key, bytes) => { await write(key, bytes); if (key.startsWith('head-')) throw Error('acknowledgement lost'); };
  const assets = createObservedPopulationAssets(capability, storage, codec, '1.0.258');
  expect((await assets.refresh(candidateFixture().transport)).core.run_date).toBe('2026-11-03');
  expect((await assets.restore())?.core.run_date).toBe('2026-11-03');
});

test.each(['core.bin', 'details.bin', 'selection.json'])('corrupt committed %s never falls back to older data', async suffix => {
  const { storage, files } = memoryStorage(), assets = createObservedPopulationAssets(capability, storage, codec, '1.0.258');
  await assets.refresh(candidateFixture().transport); await assets.refresh(candidateFixture(2).transport);
  files.set(`edition-2/${suffix}`, utf8ToBytes('{}'));
  await expect(assets.restore()).rejects.toThrow();
});

test('late older request cannot roll back a newer commit, including across cache owners', async () => {
  const { storage } = memoryStorage(), old = candidateFixture(), newer = candidateFixture(2);
  let release!: () => void; const blocked = new Promise<void>(resolve => { release = resolve; });
  const read = old.transport.readBytes; old.transport.readBytes = async request => { await blocked; return read(request); };
  const first = createObservedPopulationAssets(capability, storage, codec, '1.0.258').refresh(old.transport);
  const assets = createObservedPopulationAssets(capability, storage, codec, '1.0.258');
  await assets.refresh(newer.transport); release();
  await expect(first).rejects.toThrow('stale');
  expect((await assets.restore())?.selection.manifest.payload_revision?.revision).toBe(2);
  await expect(assets.restore(candidateFixture(3).manifest)).rejects.toThrow('stale');
});

test.each(['download', 'hash', 'date', 'missing-details', 'accounting', 'wise', 'invalid-name', 'invalid-rate', 'invalid-comparison', 'cancelled', 'owner'])('rejects %s without changing committed edition', async mode => {
  const { storage, files } = memoryStorage(), assets = createObservedPopulationAssets(capability, storage, codec, '1.0.258');
  await assets.refresh(candidateFixture().transport); const head = files.get('head-1.json')!.slice();
  const f = candidateFixture(2, (core, details) => {
    if (mode === 'date') details.run_date = '2026-11-02';
    if (mode === 'missing-details') delete details.products[Object.keys(details.products)[0]];
    if (mode === 'accounting') (core.coverage!.payload_accounting as { source_rates: number }).source_rates++;
    if (mode === 'wise') core.sections.Mortgage.rates[0].provider = 'Wise';
    if (mode === 'invalid-name') core.sections.Mortgage.rates[0].product_name = {} as never;
    if (mode === 'invalid-rate') core.sections.Mortgage.rates[0].rate = 'Infinity';
    if (mode === 'invalid-comparison') core.sections.Mortgage.rates[0].comparison_rate = 'not-a-rate';
  });
  if (mode === 'download') f.transport.readBytes = async () => { throw Error('offline'); };
  if (mode === 'hash') f.wire.core[12] ^= 1;
  const abort = new AbortController(); if (mode === 'cancelled') abort.abort();
  await expect(assets.refresh(f.transport, undefined, abort.signal, () => mode !== 'owner')).rejects.toThrow();
  expect(files.get('head-1.json')).toEqual(head);
  expect((await assets.restore())?.selection.manifest.payload_revision?.revision).toBe(1);
});

test('retains exactly the two committed editions after successful advances', async () => {
  const { storage, files } = memoryStorage(), assets = createObservedPopulationAssets(capability, storage, codec, '1.0.258');
  for (let revision = 1; revision <= 4; revision++) await assets.refresh(candidateFixture(revision).transport);
  expect([...files.keys()].some(key => /^edition-[12]\//.test(key))).toBe(false);
  expect((await assets.restore())?.selection.manifest.payload_revision?.revision).toBe(4);
});

test('requires explicit capability before accessing cache or transport', () => {
  expect(() => createObservedPopulationAssets(undefined, memoryStorage().storage, codec, '1.0.258')).toThrow('capability');
});

test('an unrevisioned installed edition still protects its later observation day', async () => {
  const f = candidateFixture(), installed = { ...f.manifest, run_date: '2026-11-04', payload_revision: undefined };
  const { storage, files } = memoryStorage(), assets = createObservedPopulationAssets(capability, storage, codec, '1.0.258');
  await expect(assets.refresh(f.transport, installed)).rejects.toThrow('stale publication day');
  expect(files.size).toBe(0);
});

test.each(['missing-generated', 'invalid-generated', 'missing-schedule', 'invalid-due', 'newer-app', 'unsupported-capability', 'unsupported-file'])('rejects %s before asset downloads or cache writes', async mode => {
  const f = candidateFixture(1, undefined, manifest => {
    if (mode === 'missing-generated') delete (manifest as Partial<typeof manifest>).generated_at;
    if (mode === 'invalid-generated') manifest.generated_at = '2026-02-30T14:00:00Z';
    if (mode === 'missing-schedule') delete (manifest as Partial<typeof manifest>).schedule;
    if (mode === 'invalid-due') manifest.schedule.next_due_utc = '2026-11-03T25:00:00Z';
    if (mode === 'newer-app') manifest.app_min_version = '99.0.0';
    if (mode === 'unsupported-capability') manifest.executable_v2 = {} as never;
    if (mode === 'unsupported-file') manifest.files.search_index = { ...manifest.files.details };
  });
  const { storage, files } = memoryStorage(), assets = createObservedPopulationAssets(capability, storage, codec, '1.0.258');
  const read = jest.spyOn(f.transport, 'readBytes');
  await expect(assets.refresh(f.transport)).rejects.toThrow();
  expect(read).not.toHaveBeenCalled(); expect(files.size).toBe(0);
});
