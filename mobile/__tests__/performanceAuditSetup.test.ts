import {
  cancelPerformanceAudit, getPerformanceAuditState, markPerformanceAuditRunning,
  pausePerformanceAudit, resumePerformanceAudit, requestPerformanceAudit, resetPerformanceAuditForTests, type AuditCheck,
} from '../src/lib/performanceAudit';
import * as planModule from '../src/lib/performanceAuditPlan';
import {
  buildPerformanceAuditSetupPlans, measurePerformanceAuditSetupStage,
  PERFORMANCE_AUDIT_SETUP_STAGES, PERFORMANCE_AUDIT_SETUP_CHECK_IDS,
} from '../src/lib/performanceAuditSetup';

beforeEach(() => {
  jest.useFakeTimers();
  resetPerformanceAuditForTests();
  requestPerformanceAudit();
  markPerformanceAuditRunning(10);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

const assertActive = () => {
  if (getPerformanceAuditState().cancelRequested) throw new Error('cancelled');
};

it('permits genuine completed setup stages totalling more than ten seconds and retains their metrics', async () => {
  const checks: AuditCheck[] = [];
  const onFailure = jest.fn();
  for (const stage of [PERFORMANCE_AUDIT_SETUP_STAGES.inputs, PERFORMANCE_AUDIT_SETUP_STAGES.inventory,
    PERFORMANCE_AUDIT_SETUP_STAGES.environment]) {
    const pending = measurePerformanceAuditSetupStage(stage,
      () => new Promise<number>(resolve => setTimeout(() => resolve(2_348), 6_000)),
      { assertActive, onFailure, metrics: count => ({ uniqueDestinations: count, inventorySlices: 160 }) });
    await jest.advanceTimersByTimeAsync(6_000);
    const result = await pending;
    checks.push(result.check);
  }
  expect(checks.map(check => [check.id, check.status, check.durationMs])).toEqual([
    ['setup-pinned-inputs', 'pass', 6_000], ['setup-external-link-inventory', 'pass', 6_000],
    ['setup-environment', 'pass', 6_000],
  ]);
  expect(checks[1].metrics).toMatchObject({ uniqueDestinations: 2_348, inventorySlices: 160, executionAttempted: true });
  expect(onFailure).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it('fails a single unfinished stage at ten seconds despite sub-operation progress and ignores late completion', async () => {
  let finish!: () => void;
  const onFailure = jest.fn();
  const pending = measurePerformanceAuditSetupStage(PERFORMANCE_AUDIT_SETUP_STAGES.inventory, async watchdog => {
    await new Promise<void>(resolve => setTimeout(resolve, 6_000));
    watchdog.touchProgress();
    await new Promise<void>(resolve => { finish = resolve; });
    watchdog.assertWithinBudget();
  }, { assertActive, onFailure });
  const failed = expect(pending).rejects.toThrow('10-second step limit');
  await jest.advanceTimersByTimeAsync(10_000);
  await failed;
  expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({
    id: 'setup-external-link-inventory', status: 'fail', durationMs: 10_000,
    metrics: expect.objectContaining({ stepLimitExceeded: true }),
  }));
  finish();
  await Promise.resolve();
  expect(onFailure).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

it('includes synchronous catalogue work and final metric construction in the same deadline', async () => {
  let clock = 0;
  const onFailure = jest.fn();
  await expect(measurePerformanceAuditSetupStage(PERFORMANCE_AUDIT_SETUP_STAGES.inputs, () => {
    clock += 9_000;
    return 'prepared';
  }, { assertActive, onFailure, clock: () => clock, metrics: () => { clock += 1_001; return {}; } }))
    .rejects.toThrow('10-second step limit');
  expect(onFailure.mock.calls[0][0]).toMatchObject({ durationMs: 10_001, status: 'fail' });
});

it('excludes an offscreen pause without renewing the foreground setup deadline', async () => {
  let finish!: () => void;
  const onFailure = jest.fn();
  const pending = measurePerformanceAuditSetupStage(PERFORMANCE_AUDIT_SETUP_STAGES.inventory,
    () => new Promise<void>(resolve => { finish = resolve; }), { assertActive, onFailure });
  await jest.advanceTimersByTimeAsync(4_000);
  pausePerformanceAudit();
  await jest.advanceTimersByTimeAsync(60_000);
  resumePerformanceAudit();
  await jest.advanceTimersByTimeAsync(5_000);
  finish();
  expect((await pending).check).toMatchObject({ status: 'pass', durationMs: 9_000 });
  expect(onFailure).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it('preserves required-stage failures and cancellation instead of continuing setup', async () => {
  const onFailure = jest.fn();
  const failure = new Error('journal could not be persisted');
  await expect(measurePerformanceAuditSetupStage(PERFORMANCE_AUDIT_SETUP_STAGES.safety, () => {
    throw failure;
  }, { assertActive, onFailure })).rejects.toBe(failure);
  expect(onFailure.mock.calls[0][0]).toMatchObject({ id: 'setup-safety', status: 'fail', error: expect.stringContaining('journal') });
  const cancelled = measurePerformanceAuditSetupStage(PERFORMANCE_AUDIT_SETUP_STAGES.payload,
    () => new Promise(() => {}), { assertActive, onFailure });
  const rejected = expect(cancelled).rejects.toThrow('cancelled');
  cancelPerformanceAudit();
  await jest.advanceTimersByTimeAsync(50);
  await rejected;
  expect(jest.getTimerCount()).toBe(0);
});

it('shares one seeded selection between both plan consumers without a second catalogue derivation', () => {
  const selected = planModule.deriveDeepAuditInputs(null, { seed: 'session-seed' });
  selected.provider = 'Selected bank';
  const derive = jest.spyOn(planModule, 'deriveDeepAuditInputs').mockReturnValue(selected);
  const prepared = buildPerformanceAuditSetupPlans(null, { seed: 'session-seed' });
  expect(derive).toHaveBeenCalledTimes(1);
  expect(prepared.plan.inputs).toBe(selected);
  expect(prepared.plan.inputs.sampling.seed).toBe('session-seed');
  expect(prepared.journeys.find(journey => journey.expectedPath === '/bank/Selected%20bank'))
    .toMatchObject({ href: { pathname: '/bank/[provider]', params: { provider: selected.provider } } });
  expect(new Set(PERFORMANCE_AUDIT_SETUP_CHECK_IDS).size).toBe(5);
});
