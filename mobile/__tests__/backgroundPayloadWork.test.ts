import { BackgroundPayloadWorkRegistry } from '../src/lib/backgroundPayloadWork';

test('times pre-existing work, overlapping jobs, queue waits and completed stages independently', () => {
  let now = 1_800_000_000_000;
  const registry = new BackgroundPayloadWorkRegistry(() => now);
  const old = registry.begin('History', '2026-10-04', 'Decode baseline');
  now += 60_000;
  const observingAt = now;
  const fresh = registry.begin('History', '2026-10-11', 'Queued');
  now += 90_000;
  const before = registry.snapshot(observingAt);
  expect(before.map(job => job.elapsedMs)).toEqual([150_000, 90_000]);
  old.stage('Merge');
  now += 2_000;
  old.finish('superseded');
  fresh.stage('Read checkpoint');
  now += 3_000;
  fresh.finish('fallback');
  const after = registry.snapshot(observingAt);
  expect(after[0]).toMatchObject({ elapsedMs: 152_000, outcome: 'superseded',
    stages: [{ label: 'Decode baseline', durationMs: 150_000, active: false },
      { label: 'Merge', durationMs: 2_000, active: false }] });
  expect(after[1]).toMatchObject({ elapsedMs: 95_000, outcome: 'fallback',
    stages: [{ label: 'Queued', durationMs: 92_000 }, { durationMs: 3_000 }] });
  expect(before[0].stages[0]).toMatchObject({ durationMs: 150_000, active: true });
  old.finish('completed');
  expect(registry.snapshot(observingAt)[0].outcome).toBe('superseded');
  expect(registry.snapshot(now + 1)).toEqual([]);
});

test('bounds completed diagnostics and stages without hiding any in-flight worker', () => {
  const registry = new BackgroundPayloadWorkRegistry(() => 1_800_000_000_000);
  for (let i = 0; i < 80; i++) registry.begin('finished').finish();
  for (let i = 0; i < 80; i++) registry.begin('active');
  expect(registry.snapshot()).toHaveLength(112);
  expect(registry.snapshot().filter(job => job.outcome === null)).toHaveLength(80);
  expect(registry.hasActiveWork()).toBe(true);
  const work = registry.begin('x'.repeat(2000), 'y'.repeat(2000));
  for (let i = 0; i < 80; i++) work.stage(`step ${i}`);
  const entry = registry.snapshot().at(-1)!;
  expect(entry.label).toHaveLength(160);
  expect(entry.runDate).toHaveLength(128);
  expect(entry.stages).toHaveLength(32);
  expect(entry.omittedStages).toBe(49);
});

test('observer snapshots do not fabricate worker progress', () => {
  let now = 1_800_000_000_000;
  const registry = new BackgroundPayloadWorkRegistry(() => now);
  const work = registry.begin('History', null, 'Decode');
  now += 60_000;
  expect(registry.snapshot()[0]).toMatchObject({ processingCheckpoints: 0, lastCheckpointAgeMs: null });
  work.checkpoint();
  now += 2_000;
  expect(registry.snapshot()[0]).toMatchObject({ processingCheckpoints: 1, lastCheckpointAgeMs: 2_000 });
  now += 10_000;
  expect(registry.snapshot()[0]).toMatchObject({ processingCheckpoints: 1, lastCheckpointAgeMs: 12_000 });
  work.checkpoint();
  expect(registry.snapshot()[0]).toMatchObject({ processingCheckpoints: 2, lastCheckpointAgeMs: 0 });
  work.finish();
  now += 100_000;
  work.checkpoint();
  expect(registry.snapshot()[0]).toMatchObject({ processingCheckpoints: 2, lastCheckpointAgeMs: 0 });
});

test('observations retire invalidated ownership without inventing processing checkpoints', () => {
  const registry = new BackgroundPayloadWorkRegistry(() => 1_800_000_000_000);
  let current = true;
  registry.begin('Detached history', null, 'Native cache read', () => current);
  expect(registry.hasActiveWork()).toBe(true);
  current = false;
  expect(registry.snapshot()[0]).toMatchObject({ outcome: 'superseded', processingCheckpoints: 0 });
  expect(registry.hasActiveWork()).toBe(false);
});
