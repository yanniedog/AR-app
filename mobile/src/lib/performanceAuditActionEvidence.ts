import type { DeepAuditStep } from './performanceAuditPlan';

/** Validate the effect after the mounted action and its readiness have been proven. */
export function assertObservableAuditActionEffect({
  semanticActionId,
  stateImpact,
  verifiedIdempotentFixture,
  pathChanged,
  renderRevisionBefore,
  renderRevisionAfter,
}: {
  semanticActionId: string;
  stateImpact: DeepAuditStep['safety']['stateImpact'];
  verifiedIdempotentFixture: boolean;
  pathChanged: boolean;
  renderRevisionBefore: string | null;
  renderRevisionAfter: string | null;
}): void {
  if (stateImpact !== 'none' && !semanticActionId.includes('.scroll.') &&
      !verifiedIdempotentFixture && !pathChanged && renderRevisionBefore === renderRevisionAfter) {
    throw new Error(
      `Mounted action completed without an observable path or render-state change: ` +
      `${semanticActionId} (${renderRevisionBefore ?? 'no render revision'})`,
    );
  }
}
