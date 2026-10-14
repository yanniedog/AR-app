import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { BackgroundWorkDiagnosis } from '../src/components/BackgroundWorkDiagnosis';
import type { AuditBackgroundWorkWait } from '../src/lib/performanceAuditBackgroundWork';
import { BackgroundPayloadWorkRegistry } from '../src/lib/backgroundPayloadWork';
import { uiBackgroundWorkName, uiBackgroundWorkStage } from '../src/lib/uiCopy';

type TestNode = { type: unknown; children: unknown[]; props: { onPress: () => void } };
type Renderer = ReactTestRenderer & { root: {
  findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
  find: (predicate: (node: TestNode) => boolean) => TestNode;
} };

jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Card: 'Card', Button: 'Button' }));

test('shows wait separately from pre-existing worker age and reveals earlier stage timings', async () => {
  const wait: AuditBackgroundWorkWait = {
    startedAt: '2026-10-11T00:00:00Z', capturedAt: '2026-10-11T00:05:00Z',
    elapsedMs: 300_000, status: 'interrupted',
    payloadWork: { capturedAt: '', refreshing: false, postRefreshWarming: true,
      bankRateHistoryLoading: true, detailsLoading: false,
      activeWork: ['postRefreshWarming', 'bankRateHistoryLoading'],
      revision: { runDate: null, manifestRunDate: null, coreSha: null, detailsSha: null, payloadRevision: null, bundleSha: null } },
    jobs: [{ id: 1, label: 'Historical catalogue preparation', runDate: '2026-10-04', startedAt: '', finishedAt: null,
      elapsedMs: 420_000, outcome: null, stage: 'Merging verified history observations', stageElapsedMs: 143_000, omittedStages: 0,
      stages: [{ label: 'Decoding and validating bundled fallback catalogue', startedAt: '', durationMs: 277_000, active: false },
        { label: 'Merging verified history observations', startedAt: '', durationMs: 143_000, active: true }] }],
  };
  let tree!: Renderer;
  await act(async () => { tree = TestRenderer.create(<BackgroundWorkDiagnosis wait={wait} />) as Renderer; });
  const text = () => tree.root.findAll(node => node.type === ('AppText' as unknown)).map(node => node.children.join('')).join('\n');
  expect(text()).toContain('Duration: 300.0 seconds · Cancelled');
  expect(text()).toContain('Wall clock · Overlapping jobs · Nonadditive');
  expect(text()).toContain('Historical catalogue · 1 · 4 Oct 2026 · 420.0 seconds · Pending');
  expect(text()).toContain('Stage: Catalogue merge · 143.0 seconds · Checkpoints: Unknown');
  expect(text()).toContain('Last evidence: Unverified · Pending');
  expect(text()).toContain('Active jobs: 2');
  expect(text()).not.toContain('277.0 seconds');
  const button = tree.root.find(node => node.type === ('Button' as unknown));
  await act(async () => button.props.onPress());
  expect(text()).toContain('Stage 1: Fallback catalogue · 277.0 seconds · Complete');
  expect(text()).toContain('Stage 2: Catalogue merge · 143.0 seconds · Pending');
  await act(async () => button.props.onPress());
  expect(text()).not.toContain('277.0 seconds');
  await act(async () => tree.unmount());
});

test('actual worker snapshots keep independent identities, transfer filenames and bounded stage metrics', () => {
  const registry = new BackgroundPayloadWorkRegistry(() => 1_000);
  const payload = registry.begin('Payload refresh', '2026-10-14', 'Fetching current manifest');
  const prepared = registry.begin('Prepared bank history', '2026-10-13', 'Reading asset cache');
  registry.begin('Product details and suitability index', '2026-10-12', 'Rebuilding suitability index from loaded details');
  registry.begin('Post-refresh warming', '2026-10-11', 'Computing rate-change notifications');
  payload.stage('download: core.json.gz'); prepared.stage('persist encoded characters=303035');
  const jobs = registry.snapshot(), original = JSON.stringify(jobs);
  expect(jobs.map(uiBackgroundWorkName)).toEqual(['Payload refresh', 'Prepared bank history', 'Details / matching', 'Post-refresh warming']);
  expect(jobs.map(job => uiBackgroundWorkStage(job))).toEqual(['Download · core.json.gz', 'Characters: 303,035', 'Suitability index', 'Notification calculation']);
  expect(uiBackgroundWorkStage(jobs[0], 0)).toBe('Manifest');
  expect(uiBackgroundWorkStage(jobs[0], 1)).toBe('Download · core.json.gz');
  payload.stage('finalize: manifest.json'); expect(uiBackgroundWorkStage(registry.snapshot()[0])).toBe('Finalization · manifest.json');
  expect(JSON.stringify(jobs)).toBe(original);
});

test('unreviewed worker or stage paragraphs never become interface copy', () => {
  const registry = new BackgroundPayloadWorkRegistry(() => 1_000);
  const worker = registry.begin('An explanatory worker description.', null, 'A generated stage explanation.');
  let job = registry.snapshot()[0];
  expect(uiBackgroundWorkName(job)).toBe('Source review required'); expect(uiBackgroundWorkStage(job)).toBe('Source review required');
  for (const stage of ['download: Explanatory source paragraph.', 'persist encoded characters=303035 extra words', 'constructor']) {
    worker.stage(stage); job = registry.snapshot()[0]; expect(uiBackgroundWorkStage(job)).toBe('Source review required');
  }
  expect(uiBackgroundWorkStage(job, 1000)).toBe('Source review required');
});
