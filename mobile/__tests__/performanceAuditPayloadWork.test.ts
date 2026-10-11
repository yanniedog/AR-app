import type { CorePayload, Manifest } from '../src/types';
import { captureAuditPayloadWork } from '../src/lib/performanceAuditPayloadWork';

const capturedAt = '2026-09-27T00:00:00.000Z';
const state = () => ({
  refreshing: false, postRefreshWarming: true, bankRateHistoryLoading: true, detailsLoading: false,
  core: { run_date: '2026-09-27', sections: { secret: 'do not export rows' } } as unknown as CorePayload,
  manifest: {
    run_date: '2026-09-27', files: { core: { sha256: 'a'.repeat(64) }, details: { sha256: 'b'.repeat(64) } },
    payload_revision: { revision: 3, bundle_sha256: 'c'.repeat(64), generation_id: 'not needed' },
    privateMetadata: 'do not export unrelated fields',
  } as unknown as Manifest,
});

test('captures active payload work and the current unpinned edition without retaining mutable state', () => {
  const source = state();
  const snapshot = captureAuditPayloadWork(source, capturedAt);
  source.postRefreshWarming = false;
  source.bankRateHistoryLoading = false;
  source.manifest.payload_revision!.revision = 4;
  source.manifest.files.core.sha256 = 'd'.repeat(64);
  expect(snapshot).toEqual({
    capturedAt, refreshing: false, postRefreshWarming: true, bankRateHistoryLoading: true, detailsLoading: false,
    activeWork: ['postRefreshWarming', 'bankRateHistoryLoading'],
    revision: { runDate: '2026-09-27', manifestRunDate: '2026-09-27', coreSha: 'a'.repeat(64),
      detailsSha: 'b'.repeat(64), payloadRevision: 3, bundleSha: 'c'.repeat(64) },
  });
  expect(JSON.stringify(snapshot)).not.toMatch(/secret|do not export|not needed|privateMetadata/);
});

test('retains each loading flag independently and represents an absent revision as unknown', () => {
  const snapshot = captureAuditPayloadWork({ refreshing: true, postRefreshWarming: false,
    bankRateHistoryLoading: false, detailsLoading: true, core: null, manifest: null }, capturedAt);
  expect(snapshot.activeWork).toEqual(['refreshing', 'detailsLoading']);
  expect(snapshot.revision).toEqual({ runDate: null, manifestRunDate: null, coreSha: null,
    detailsSha: null, payloadRevision: null, bundleSha: null });
});

test('bounds unexpected metadata and tolerates incomplete state during failure capture', () => {
  const source = state();
  source.core.run_date = 'x'.repeat(20_000);
  source.manifest = { run_date: 'y'.repeat(20_000), payload_revision: { revision: NaN } } as Manifest;
  const snapshot = captureAuditPayloadWork(source, capturedAt);
  expect(snapshot.revision.runDate).toHaveLength(128);
  expect(snapshot.revision.manifestRunDate).toHaveLength(128);
  expect(snapshot.revision.coreSha).toBeNull();
  expect(snapshot.revision.payloadRevision).toBeNull();
  expect(JSON.stringify(snapshot).length).toBeLessThan(1024);
});
