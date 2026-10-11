import { createMissingPublicPayloadRecovery } from '../src/data/missingPublicPayloadRecovery';
import { MissingPublicPayloadError } from '../src/lib/automaticDataAccess';
import { sampleManifest } from '../src/data/sample';
import type { Manifest } from '../src/types';

let mockLocalAudit = false;
jest.mock('../src/lib/appHealthTransportGuard', () => ({ isLocalAppHealthAudit: () => mockLocalAudit }));

function setup() {
  const manifest: Manifest = { ...sampleManifest, repo: 'yanniedog/AR-local', tag: 'app-payload-2026-09-26',
    files: { ...sampleManifest.files,
      details: { ...sampleManifest.files.details, url: 'https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-09-26/details.json.gz' },
      search_index: { ...sampleManifest.files.details, url: 'https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-09-26/search.json.gz' },
    } };
  const refresh = jest.fn(async () => false);
  const state = { manifest, source: 'remote' as const, refreshing: false, postRefreshWarming: false, refresh };
  const recover = createMissingPublicPayloadRecovery(() => state);
  const missing = new MissingPublicPayloadError(manifest.files.details.url);
  const adopt = () => { state.manifest = { ...manifest, files: { ...manifest.files,
    core: { ...manifest.files.core, sha256: 'next-core' } } }; };
  return { manifest, state, refresh, recover, missing, adopt };
}

beforeEach(() => { jest.useFakeTimers(); mockLocalAudit = false; });
afterEach(() => jest.useRealTimers());

test('coalesces missing optional assets, releases ensure before refresh, retries only after new adoption', async () => {
  const { manifest, recover, missing, refresh, adopt } = setup();
  refresh.mockImplementation(async () => { adopt(); return true; });
  const details = jest.fn(async () => {}), search = jest.fn(async () => {});
  recover(missing, manifest, details);
  recover(new MissingPublicPayloadError(manifest.files.search_index!.url), manifest, search);
  expect(refresh).not.toHaveBeenCalled();
  await jest.runAllTimersAsync();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalledWith({ background: true });
  expect(details).toHaveBeenCalledTimes(1);
  expect(search).toHaveBeenCalledTimes(1);
});

test('unchanged publication and repeated missing files do not cause refresh or retry loops', async () => {
  const { manifest, recover, missing, refresh } = setup();
  const retry = jest.fn(async () => {});
  recover(missing, manifest, retry);
  await jest.runAllTimersAsync();
  recover(missing, manifest, retry);
  await jest.runAllTimersAsync();
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(retry).not.toHaveBeenCalled();
});

test.each(['network', 'foreign', 'audit', 'refreshing', 'warming', 'superseded'] as const)(
  'does not initiate recovery for %s', async scenario => {
    const { manifest, recover, missing, refresh, state, adopt } = setup();
    const retry = jest.fn(async () => {});
    if (scenario === 'audit') mockLocalAudit = true;
    if (scenario === 'refreshing') state.refreshing = true;
    if (scenario === 'warming') state.postRefreshWarming = true;
    recover(scenario === 'network' ? new Error('asset HTTP 404') : scenario === 'foreign'
      ? new MissingPublicPayloadError('https://github.com/yanniedog/AR-local/releases/download/app-payload-2026-09-25/details.json.gz') : missing,
    manifest, retry);
    if (scenario === 'superseded') adopt();
    await jest.runAllTimersAsync();
    expect(refresh).not.toHaveBeenCalled();
    expect(retry).not.toHaveBeenCalled();
  },
);

test('a refresh failure preserves the current edition and leaves explicit retry available', async () => {
  const { manifest, recover, missing, refresh, state } = setup();
  refresh.mockRejectedValue(new Error('network down'));
  const retry = jest.fn(async () => {});
  recover(missing, manifest, retry);
  await jest.runAllTimersAsync();
  expect(state.manifest).toBe(manifest);
  expect(retry).not.toHaveBeenCalled();
});
