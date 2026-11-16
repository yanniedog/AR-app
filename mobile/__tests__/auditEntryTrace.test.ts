import {
  AUDIT_ENTRY_CHECK_IDS, buildAuditEntryChecks, markAuditEntryInterrupted, markAuditEntryRunning, markAuditEntryScreenMounted,
  markAuditEntryScreenReady, markAuditEntrySettingsOpened, markAuditEntryStartPressed, markAuditEntryStartQueued,
  resetAuditEntryTraceForTests, setAuditEntrySettingsProbe,
} from '../src/lib/auditEntryTrace';
import { stableRowsForProvider, rowsForProvider } from '../src/data/rateRowIndex';
import type { RateRow } from '../src/types';

let clock = 0;
beforeEach(() => {
  resetAuditEntryTraceForTests();
  clock = 0;
  jest.spyOn(globalThis.performance, 'now').mockImplementation(() => clock);
});
afterEach(() => jest.restoreAllMocks());

test('a run requested without the screen declares every entry phase unavailable', async () => {
  const checks = await buildAuditEntryChecks();
  expect(checks.map(check => check.id)).toEqual([...AUDIT_ENTRY_CHECK_IDS]);
  for (const check of checks) {
    expect(check).toMatchObject({ status: 'skipped', durationMs: null,
      metrics: { executionAttempted: false, availabilityFailure: true, skipClassification: 'terminal-availability' } });
  }
});

test('measures screen open, settings open and the start response from one visit', async () => {
  markAuditEntryScreenMounted();
  clock = 180; markAuditEntryScreenReady();
  clock = 900; markAuditEntryScreenReady();
  clock = 1_000; markAuditEntryStartPressed();
  clock = 1_040; markAuditEntryStartQueued();
  clock = 1_300; markAuditEntryRunning();
  setAuditEntrySettingsProbe(async () => 42);
  const [screen, settings, start] = await buildAuditEntryChecks();
  expect(screen).toMatchObject({ status: 'pass', durationMs: 180, metrics: { forwardWorkMs: 180, measurementAvailable: true } });
  expect(settings).toMatchObject({ status: 'pass', durationMs: 42, metrics: { maxFrameGapMs: 42 } });
  expect(start).toMatchObject({ status: 'pass', durationMs: 300, metrics: { actionMs: 40, forwardWorkMs: 300, nonTimingFailure: false } });
});

test('slow phases are scored with the existing latency limits and a failed probe falls back to the traced open', async () => {
  markAuditEntryScreenMounted();
  clock = 3_000; markAuditEntryScreenReady();
  markAuditEntrySettingsOpened(400);
  const probe = jest.fn(async () => 42);
  setAuditEntrySettingsProbe(probe);
  clock = 4_000; markAuditEntryStartPressed();
  clock = 5_000; markAuditEntryStartQueued();
  clock = 5_100; markAuditEntryRunning();
  const [screen, settings, start] = await buildAuditEntryChecks();
  expect(screen.status).toBe('fail');
  expect(settings).toMatchObject({ status: 'fail', durationMs: 400 });
  expect(start).toMatchObject({ status: 'warn', metrics: { actionMs: 1_000 } });
  // The person's own slow open is kept; the warmed probe is not consulted.
  expect(probe).not.toHaveBeenCalled();
});

test('press marks belong to one run, survive a remount and are withheld after an interruption', async () => {
  markAuditEntryScreenMounted();
  clock = 100; markAuditEntryScreenReady();
  clock = 200; markAuditEntryStartPressed();
  clock = 240; markAuditEntryStartQueued();
  markAuditEntryScreenMounted();
  clock = 400; markAuditEntryRunning();
  expect((await buildAuditEntryChecks())[2]).toMatchObject({ status: 'pass', durationMs: 200 });
  expect((await buildAuditEntryChecks())[2].status).toBe('skipped');
  clock = 500; markAuditEntryStartPressed();
  clock = 520; markAuditEntryStartQueued();
  markAuditEntryInterrupted();
  clock = 90_000; markAuditEntryRunning();
  expect((await buildAuditEntryChecks())[2]).toMatchObject({ status: 'skipped', durationMs: null });
});

test('a lender keeps one row-array identity per edition while copies stay caller-owned', () => {
  const rows: RateRow[] = [
    { product_key: 'a', provider: 'Bank', product_name: 'a', rate: '0.05' },
    { product_key: 'b', provider: 'Other', product_name: 'b', rate: '0.05' },
  ];
  expect(stableRowsForProvider(rows, 'Bank')).toBe(stableRowsForProvider(rows, 'Bank'));
  expect(stableRowsForProvider(rows, 'Bank')).toEqual([rows[0]]);
  expect(rowsForProvider(rows, 'Bank')).not.toBe(stableRowsForProvider(rows, 'Bank'));
  const copy = rowsForProvider(rows, 'Bank');
  expect(rowsForProvider(rows, 'Bank')).not.toBe(copy);
  copy.pop();
  expect(rowsForProvider(rows, 'Bank')).toEqual([rows[0]]);
  expect(stableRowsForProvider(rows, 'Bank')).toEqual([rows[0]]);
  expect(stableRowsForProvider(rows, 'Missing')).toEqual([]);
});
