import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { BackgroundWorkDiagnosis } from '../src/components/BackgroundWorkDiagnosis';
import type { AuditBackgroundWorkWait } from '../src/lib/performanceAuditBackgroundWork';

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
  let tree!: ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(<BackgroundWorkDiagnosis wait={wait} />); });
  const text = () => tree.root.findAll(node => node.type === ('AppText' as unknown)).map(node => node.children.join('')).join('\n');
  expect(text()).toContain('Audit waited 300.0 s');
  expect(text()).toContain('History (2026-10-04): 420.0 s');
  expect(text()).toContain('still active at capture');
  expect(text()).not.toContain('Baseline decode: 277.0 s');
  const button = tree.root.find(node => node.type === ('Button' as unknown));
  await act(async () => button.props.onPress());
  expect(text()).toContain('Baseline decode: 277.0 s');
  expect(text()).toContain('Merge: 143.0 s (active at capture)');
  await act(async () => tree.unmount());
});
