import {
  PerformanceAuditStepWatchdog, roundMetric, formatAuditError,
  buildPerformanceAuditJourneysFromInputs,
  type AuditCheck, type AuditMetricValue,
} from './performanceAudit';
import { PERFORMANCE_AUDIT_STEP_LIMIT_MS } from './performanceAuditTiming';
import { awaitPerformanceAuditWork } from './performanceAuditWork';
import { buildDeepPerformanceAuditPlanFromInputs, deriveDeepAuditInputs, type DeepAuditSelectionOptions } from './performanceAuditPlan';
import type { CorePayload, SectionKey } from '../types';

export function buildPerformanceAuditSetupPlans(core: CorePayload | null,
  options: DeepAuditSelectionOptions = {}, interests?: SectionKey[]) {
  const inputs = deriveDeepAuditInputs(core, options);
  return { plan: buildDeepPerformanceAuditPlanFromInputs(inputs),
    journeys: buildPerformanceAuditJourneysFromInputs(inputs, interests) };
}

export const PERFORMANCE_AUDIT_SETUP_STAGES = {
  safety: { id: 'setup-safety', label: 'Preparing safe audit execution and rollback journal', kind: 'storage' },
  payload: { id: 'setup-payload-settle', label: 'Waiting for active payload work to finish', kind: 'data' },
  inputs: { id: 'setup-pinned-inputs', label: 'Capturing pinned catalogue evidence and audit plan', kind: 'data' },
  inventory: { id: 'setup-external-link-inventory', label: 'Preparing the complete initial external link inventory', kind: 'data' },
  environment: { id: 'setup-environment', label: 'Capturing device and app state', kind: 'runtime' },
} as const satisfies Record<string, Pick<AuditCheck, 'id' | 'label' | 'kind'>>;
export const PERFORMANCE_AUDIT_SETUP_CHECK_IDS = Object.values(PERFORMANCE_AUDIT_SETUP_STAGES).map(stage => stage.id);

/** Setup consists of real completed operations, each with its own nonrenewable
 * deadline. The caller durably records each result before starting another. */
export async function measurePerformanceAuditSetupStage<T>(
  stage: Pick<AuditCheck, 'id' | 'label' | 'kind'>,
  run: (watchdog: PerformanceAuditStepWatchdog) => Promise<T> | T,
  options: {
    assertActive: () => void;
    metrics?: (result: T) => Record<string, AuditMetricValue>;
    onFailure: (check: AuditCheck) => void;
    /** Drain owned work after recording failure, before an outer caller restores policy. */
    drainOnFailure?: () => Promise<void>;
    clock?: () => number;
  },
): Promise<{ value: T; check: AuditCheck }> {
  const watchdog = new PerformanceAuditStepWatchdog(stage.label, options.clock);
  const metrics = { setupStage: true, executionAttempted: true, stepLimitMs: PERFORMANCE_AUDIT_STEP_LIMIT_MS };
  try {
    const value = await awaitPerformanceAuditWork(() => Promise.resolve(run(watchdog)), {
      assertActive: () => { options.assertActive(); watchdog.assertWithinBudget(); },
      label: stage.label, timeoutMs: PERFORMANCE_AUDIT_STEP_LIMIT_MS, clock: options.clock,
    });
    const evidence = options.metrics?.(value) ?? {};
    watchdog.assertWithinBudget();
    return { value, check: { ...stage, status: 'pass', durationMs: roundMetric(watchdog.elapsedMs),
      metrics: { ...metrics, ...evidence } } };
  } catch (error) {
    options.onFailure({ ...stage, status: 'fail', durationMs: roundMetric(watchdog.elapsedMs),
      metrics: { ...metrics, stepLimitExceeded: watchdog.elapsedMs >= PERFORMANCE_AUDIT_STEP_LIMIT_MS },
      error: formatAuditError(error) });
    await options.drainOnFailure?.();
    throw error;
  } finally {
    watchdog.close();
  }
}
