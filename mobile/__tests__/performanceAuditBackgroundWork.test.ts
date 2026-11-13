import { backgroundPayloadWork } from '../src/lib/backgroundPayloadWork';
import { classifyJourneyBackgroundObservation, describeAuditBackgroundWork, journeyDetailsRequirementState, waitForAuditBackgroundWork, type AuditBackgroundWorkWait } from '../src/lib/performanceAuditBackgroundWork';
import { compactPerformanceAuditReportForLog } from '../src/lib/performanceAuditLog';

const state = () => ({ refreshing: false, postRefreshWarming: false,
  bankRateHistoryLoading: true, detailsLoading: false, core: null, manifest: null });
afterEach(() => jest.restoreAllMocks());

test('details that have not claimed a load stay pending, and an unclaimed settle does not fail the journey', () => {
  expect(journeyDetailsRequirementState({ loading: false, matches: false, claimed: false })).toBe('pending');
  expect(journeyDetailsRequirementState({ loading: true, matches: false, claimed: true })).toBe('pending');
  expect(journeyDetailsRequirementState({ loading: false, matches: true, claimed: true })).toBe('ready');
  expect(journeyDetailsRequirementState({ loading: false, matches: false, claimed: true })).toBe('failed');
  expect(classifyJourneyBackgroundObservation({
    states: ['pending'], elapsedMs: 1_000, deadlineMs: 10_000, unclaimedPending: true,
  })).toBe('unsettled');
  expect(classifyJourneyBackgroundObservation({
    states: ['pending'], elapsedMs: 10_000, deadlineMs: 10_000,
  })).toBe('unsettled');
  expect(classifyJourneyBackgroundObservation({
    states: ['failed'], elapsedMs: 200, deadlineMs: 10_000,
  })).toBe('failed');
  expect(classifyJourneyBackgroundObservation({
    states: ['ready'], elapsedMs: 200, deadlineMs: 10_000,
  })).toBe('settled');
});

test('captures stage and total time at watchdog interruption without completing a check', async () => {
  let now = 1_900_000_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const work = backgroundPayloadWork.begin('History', '2026-10-04', 'Baseline decode');
  now += 120_000;
  const started = now;
  const observations: AuditBackgroundWorkWait[] = [];
  const assertActive = jest.fn(() => { if (now - started >= 300_000) throw new Error('watchdog expired'); });
  await expect(waitForAuditBackgroundWork({ getState: state, assertActive,
    observe: wait => observations.push(wait), delay: async ms => { now += ms; } })).rejects.toThrow('watchdog expired');
  const final = observations.at(-1)!;
  expect(final).toMatchObject({ status: 'interrupted', elapsedMs: 300_000,
    jobs: [{ label: 'History', runDate: '2026-10-04', elapsedMs: 420_000, stageElapsedMs: 420_000, outcome: null }] });
  expect(describeAuditBackgroundWork(final)).toContain('420.0s in stage');
  expect(describeAuditBackgroundWork(final)).toContain('300.0s waiting');
  expect(compactPerformanceAuditReportForLog({ backgroundWorkWait: final })).toHaveProperty('backgroundWorkWait.jobs.0.stage', 'Baseline decode');
  work.finish();
});

test('retains work completed while waiting, observes details and requires a quiet window', async () => {
  let now = 1_900_001_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const source = state();
  const work = backgroundPayloadWork.begin('History', '2026-10-11', 'Decode');
  const observations: AuditBackgroundWorkWait[] = [];
  let detailsStarted = false;
  await waitForAuditBackgroundWork({ getState: () => source, assertActive: () => {},
    observe: wait => observations.push(wait), delay: async ms => {
      now += ms;
      if (source.bankRateHistoryLoading) { source.bankRateHistoryLoading = false; work.finish(); }
      else if (!detailsStarted) { detailsStarted = true; source.detailsLoading = true; }
      else source.detailsLoading = false;
    } });
  expect(observations.at(-1)).toMatchObject({ status: 'settled', elapsedMs: 400,
    jobs: [{ outcome: 'completed', elapsedMs: 50, stages: [{ durationMs: 50, active: false }] }] });
});

test('does not declare settlement while a tracked worker finishes after its loading flag clears', async () => {
  let now = 1_900_002_000_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  const source = { ...state(), bankRateHistoryLoading: false };
  const work = backgroundPayloadWork.begin('Product details and suitability index', null, 'Recovering suitability index');
  const started = now;
  const observations: AuditBackgroundWorkWait[] = [];
  await waitForAuditBackgroundWork({ getState: () => source, assertActive: () => {},
    observe: wait => observations.push(wait), delay: async ms => {
      now += ms;
      if (now - started >= 2_000) work.finish();
    } });
  expect(observations.at(-1)).toMatchObject({ status: 'settled', elapsedMs: 2_150,
    jobs: [{ stage: 'Recovering suitability index', elapsedMs: 2_000, outcome: 'completed' }] });
});
