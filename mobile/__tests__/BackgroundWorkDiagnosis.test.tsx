import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { BackgroundWorkDiagnosis } from '../src/components/BackgroundWorkDiagnosis';
import type { AuditBackgroundWorkWait } from '../src/lib/performanceAuditBackgroundWork';

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
    jobs: [{ id: 1, label: 'History', runDate: '2026-10-04', startedAt: '', finishedAt: null,
      elapsedMs: 420_000, outcome: null, stage: 'Merge', stageElapsedMs: 143_000, omittedStages: 0,
      stages: [{ label: 'Baseline decode', startedAt: '', durationMs: 277_000, active: false },
        { label: 'Merge', startedAt: '', durationMs: 143_000, active: true }] }],
  };
  let tree!: Renderer;
  await act(async () => { tree = TestRenderer.create(<BackgroundWorkDiagnosis wait={wait} />) as Renderer; });
  const text = () => tree.root.findAll(node => node.type === ('AppText' as unknown)).map(node => node.children.join('')).join('\n');
  expect(text()).toContain('Duration: 300.0 seconds · Cancelled');
  expect(text()).toContain('Wall clock · Overlapping jobs · Nonadditive');
  expect(text()).toContain('1 · 4 Oct 2026 · 420.0 seconds · Pending');
  expect(text()).toContain('Stage: 143.0 seconds · Checkpoints: Unknown');
  expect(text()).toContain('Last evidence: Unverified · Pending');
  expect(text()).toContain('Active jobs: 2');
  expect(text()).not.toContain('277.0 seconds');
  const button = tree.root.find(node => node.type === ('Button' as unknown));
  await act(async () => button.props.onPress());
  expect(text()).toContain('Stage 1: 277.0 seconds · Complete');
  expect(text()).toContain('Stage 2: 143.0 seconds · Pending');
  await act(async () => button.props.onPress());
  expect(text()).not.toContain('277.0 seconds');
  await act(async () => tree.unmount());
});
