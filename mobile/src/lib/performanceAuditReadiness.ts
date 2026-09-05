export type PerformanceAuditReadinessKind =
  | 'data'
  | 'list'
  | 'logo'
  | 'graphic'
  | 'layout';

export type PerformanceAuditProbeStatus = 'pending' | 'ready' | 'error';

export type PerformanceAuditSemanticAction = (...args: unknown[]) => unknown | Promise<unknown>;

export interface PerformanceAuditProbeDefinition {
  id: string;
  kind: PerformanceAuditReadinessKind;
  required?: boolean;
  status?: PerformanceAuditProbeStatus;
  datasetRevision?: string | null;
  renderRevision?: string | null;
  expectedCount?: number | null;
  actualCount?: number | null;
  /** Terminal logo fallbacks within actualCount; meaningful for logo probes. */
  fallbackCount?: number | null;
  /** Rows observed by the list's viewability callback, not inferred from layout. */
  visibleCount?: number | null;
  /** Explicit proof that the surface's actual empty-state component rendered. */
  emptyStateRendered?: boolean | null;
  /** Explicit proof from a React Native layout/content-size callback. */
  layoutMeasured?: boolean | null;
  /** Explicit proof that the rendered graphic exposes a spoken summary. */
  accessibleSummary?: boolean | null;
  error?: string | null;
}

export interface PerformanceAuditProbePatch {
  kind?: PerformanceAuditReadinessKind;
  required?: boolean;
  status?: PerformanceAuditProbeStatus;
  datasetRevision?: string | null;
  renderRevision?: string | null;
  expectedCount?: number | null;
  actualCount?: number | null;
  fallbackCount?: number | null;
  visibleCount?: number | null;
  emptyStateRendered?: boolean | null;
  layoutMeasured?: boolean | null;
  accessibleSummary?: boolean | null;
  error?: string | null;
}

export interface PerformanceAuditSurfaceDefinition {
  id: string;
  routeKey?: string | null;
  datasetRevision?: string | null;
  renderRevision?: string | null;
  probes?: readonly PerformanceAuditProbeDefinition[];
  actions?: Readonly<Record<string, PerformanceAuditSemanticAction>>;
}

export interface PerformanceAuditSurfacePatch {
  routeKey?: string | null;
  datasetRevision?: string | null;
  renderRevision?: string | null;
  actions?: Readonly<Record<string, PerformanceAuditSemanticAction>>;
}

export interface PerformanceAuditCaptureHandle {
  readonly sessionId: string;
  readonly generation: number;
}

export interface PerformanceAuditSurfaceHandle {
  readonly surfaceId: string;
  readonly generation: number;
  readonly instance: number;
}

export type PerformanceAuditReadinessBlockerCode =
  | 'capture-inactive'
  | 'no-surfaces'
  | 'no-probes'
  | 'probe-pending'
  | 'probe-error'
  | 'dataset-revision-mismatch'
  | 'render-revision-mismatch'
  | 'count-incomplete'
  | 'required-kind-missing';

export interface PerformanceAuditReadinessBlocker {
  code: PerformanceAuditReadinessBlockerCode;
  surfaceId?: string;
  probeId?: string;
  message: string;
}

export interface PerformanceAuditProbeSnapshot {
  id: string;
  kind: PerformanceAuditReadinessKind;
  required: boolean;
  status: PerformanceAuditProbeStatus;
  datasetRevision: string | null;
  renderRevision: string | null;
  expectedCount: number | null;
  actualCount: number | null;
  fallbackCount: number | null;
  visibleCount: number | null;
  emptyStateRendered: boolean | null;
  layoutMeasured: boolean | null;
  accessibleSummary: boolean | null;
  error: string | null;
  updatedAtMs: number;
}

export interface PerformanceAuditSurfaceSnapshot {
  id: string;
  routeKey: string | null;
  datasetRevision: string | null;
  renderRevision: string | null;
  registeredAtMs: number;
  updatedAtMs: number;
  probes: PerformanceAuditProbeSnapshot[];
  actions: string[];
  actionRevision: number;
  lastCompletedAction: string | null;
}

export interface PerformanceAuditReadinessSnapshot {
  capturing: boolean;
  sessionId: string | null;
  generation: number;
  capturedAtMs: number;
  ready: boolean;
  totalProbes: number;
  requiredProbes: number;
  pendingRequiredProbes: number;
  surfaces: PerformanceAuditSurfaceSnapshot[];
  blockers: PerformanceAuditReadinessBlocker[];
  fingerprint: string;
}

/**
 * Machine-readable display evidence kept deliberately compact. Revisions live
 * in their own audit metrics; including them here used to push later probes
 * beyond the per-metric evidence cap and made rendered lists look absent.
 */
export function compactPerformanceAuditReadinessEvidence(
  snapshot: PerformanceAuditReadinessSnapshot,
): string {
  return snapshot.surfaces
    .flatMap((surface) => surface.probes.map((probe) => [
      surface.id,
      probe.id,
      probe.kind,
      probe.status,
      probe.actualCount == null ? '' : `${probe.actualCount}/${probe.expectedCount ?? probe.actualCount}`,
      ...(probe.fallbackCount == null ? [] : [`fallback=${probe.fallbackCount}`]),
      ...(probe.visibleCount == null ? [] : [`visible=${probe.visibleCount}`]),
      ...(probe.emptyStateRendered == null ? [] : [`empty=${probe.emptyStateRendered ? 1 : 0}`]),
      ...(probe.layoutMeasured == null ? [] : [`measured=${probe.layoutMeasured ? 1 : 0}`]),
      ...(probe.accessibleSummary == null ? [] : [`summary=${probe.accessibleSummary ? 1 : 0}`]),
    ].join(':')))
    .join(' | ');
}

export interface PerformanceAuditReadinessClock {
  now(): number;
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface WaitForPerformanceAuditReadinessOptions {
  quietWindowMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Only these mounted surfaces may satisfy this step. This prevents an
   * already-ready persistent/root surface from certifying a new destination. */
  surfaceIds?: readonly string[];
  /** Optional asset families become mandatory when the active step explicitly
   * exercises them (for example a history chart or lender-logo view). */
  requiredKinds?: readonly PerformanceAuditReadinessKind[];
  /** When set, only these probe kinds gate readiness. Required probes outside
   * this set are ignored — used before invoking mounted actions so logo/list
   * decoration cannot block unrelated navigation taps. */
  onlyKinds?: readonly PerformanceAuditReadinessKind[];
  /** A callback acknowledgement alone cannot certify a deferred UI update. */
  changedRender?: { surfaceId: string; previousRevision: string | null };
}

type MutableProbe = PerformanceAuditProbeSnapshot;

interface MutableSurface {
  id: string;
  routeKey: string | null;
  datasetRevision: string | null;
  renderRevision: string | null;
  registeredAtMs: number;
  updatedAtMs: number;
  instance: number;
  probes: Map<string, MutableProbe>;
  actions: Map<string, PerformanceAuditSemanticAction>;
  actionRevision: number;
  lastCompletedAction: string | null;
}

type Listener = () => void;

/** Survives remounts of the same surface ID within one capture session. */
export interface PerformanceAuditActionCompletion {
  readonly actionName: string;
  readonly actionRevision: number;
}

/**
 * Converts potentially sensitive render state into a capture-local monotonic
 * token. Only the opaque token is exposed to audit reports and diagnostic logs.
 */
export class OpaquePerformanceAuditRenderRevision {
  private stateKey: string | null = null;
  private revision = 0;

  update(state: readonly unknown[]): string {
    const nextKey = JSON.stringify(state);
    if (nextKey !== this.stateKey) {
      this.stateKey = nextKey;
      this.revision += 1;
    }
    return `state-${this.revision}`;
  }
}

const systemClock: PerformanceAuditReadinessClock = {
  now: () => globalThis.performance?.now?.() ?? Date.now(),
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

function nullable(value: string | null | undefined): string | null {
  return value ?? null;
}

function nullableCount(value: number | null | undefined): number | null {
  if (value == null) return null;
  return Number.isFinite(value) ? Math.max(0, value) : null;
}

function nullableBoolean(value: boolean | null | undefined): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function normalizeError(status: PerformanceAuditProbeStatus, error: string | null | undefined): string | null {
  if (status !== 'error') return null;
  const message = error?.trim();
  return message || 'Unknown readiness error';
}

function actionsMap(
  actions: Readonly<Record<string, PerformanceAuditSemanticAction>> | undefined,
): Map<string, PerformanceAuditSemanticAction> {
  const result = new Map<string, PerformanceAuditSemanticAction>();
  if (!actions) return result;
  for (const [name, action] of Object.entries(actions)) {
    if (name && typeof action === 'function') result.set(name, action);
  }
  return result;
}

function isUnavailableActionResult(result: unknown): boolean {
  if (result == null || typeof result !== 'object') return false;
  if (!('unavailableReason' in result)) return false;
  const reason = (result as { unavailableReason?: unknown }).unavailableReason;
  return typeof reason === 'string' && reason.trim().length > 0;
}

function mapsHaveSameActions(
  left: Map<string, PerformanceAuditSemanticAction>,
  right: Map<string, PerformanceAuditSemanticAction>,
): boolean {
  if (left.size !== right.size) return false;
  for (const [name, action] of left) {
    if (right.get(name) !== action) return false;
  }
  return true;
}

function probeFingerprint(surfaceId: string, probe: PerformanceAuditProbeSnapshot): string {
  return [
    surfaceId,
    probe.id,
    probe.kind,
    probe.required ? '1' : '0',
    probe.status,
    probe.datasetRevision ?? '',
    probe.renderRevision ?? '',
    probe.expectedCount ?? '',
    probe.actualCount ?? '',
    probe.fallbackCount ?? '',
    probe.visibleCount ?? '',
    probe.emptyStateRendered == null ? '' : probe.emptyStateRendered ? '1' : '0',
    probe.layoutMeasured == null ? '' : probe.layoutMeasured ? '1' : '0',
    probe.accessibleSummary == null ? '' : probe.accessibleSummary ? '1' : '0',
    probe.error ?? '',
  ].join('\u001f');
}

function readinessFingerprint(
  generation: number,
  surfaces: readonly PerformanceAuditSurfaceSnapshot[],
): string {
  const values = [`generation:${generation}`];
  for (const surface of surfaces) {
    values.push([
      'surface',
      surface.id,
      surface.routeKey ?? '',
      surface.datasetRevision ?? '',
      surface.renderRevision ?? '',
      String(surface.actionRevision),
      surface.lastCompletedAction ?? '',
    ].join('\u001f'));
    for (const probe of surface.probes) values.push(probeFingerprint(surface.id, probe));
  }
  return values.join('\u001e');
}

export class PerformanceAuditReadinessError extends Error {
  readonly snapshot: PerformanceAuditReadinessSnapshot;

  constructor(message: string, snapshot: PerformanceAuditReadinessSnapshot) {
    super(message);
    this.name = 'PerformanceAuditReadinessError';
    this.snapshot = snapshot;
  }
}

export class PerformanceAuditReadinessTimeoutError extends PerformanceAuditReadinessError {
  constructor(timeoutMs: number, snapshot: PerformanceAuditReadinessSnapshot) {
    const pending = snapshot.blockers.map((blocker) => blocker.message).join('; ') || 'unknown blocker';
    super(`Readiness did not settle after ${timeoutMs}ms: ${pending}`, snapshot);
    this.name = 'PerformanceAuditReadinessTimeoutError';
  }
}

export class PerformanceAuditReadinessProbeError extends PerformanceAuditReadinessError {
  constructor(snapshot: PerformanceAuditReadinessSnapshot) {
    const failures = snapshot.blockers
      .filter((blocker) => blocker.code === 'probe-error')
      .map((blocker) => blocker.message)
      .join('; ');
    super(`A required readiness probe failed: ${failures || 'unknown probe'}`, snapshot);
    this.name = 'PerformanceAuditReadinessProbeError';
  }
}

export class PerformanceAuditReadinessCaptureEndedError extends PerformanceAuditReadinessError {
  constructor(snapshot: PerformanceAuditReadinessSnapshot) {
    super('Performance audit readiness capture ended before the surface settled', snapshot);
    this.name = 'PerformanceAuditReadinessCaptureEndedError';
  }
}

export class PerformanceAuditReadinessRegistry {
  private capture: PerformanceAuditCaptureHandle | null = null;
  private generation = 0;
  private nextInstance = 1;
  private readonly surfaces = new Map<string, MutableSurface>();
  /** Action proof keyed by surface ID; remounts must not erase completed-step evidence. */
  private readonly actionCompletions = new Map<string, PerformanceAuditActionCompletion>();
  private readonly listeners = new Set<Listener>();
  private readonly captureListeners = new Set<Listener>();

  constructor(private readonly clock: PerformanceAuditReadinessClock = systemClock) {}

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly subscribeCapture = (listener: Listener): (() => void) => {
    this.captureListeners.add(listener);
    return () => this.captureListeners.delete(listener);
  };

  readonly getCaptureGeneration = (): number => this.generation;

  isCapturing(): boolean {
    return this.capture != null;
  }

  beginCapture(sessionId: string): PerformanceAuditCaptureHandle {
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) throw new Error('A readiness capture requires a session ID');
    this.generation += 1;
    this.capture = Object.freeze({ sessionId: normalizedSessionId, generation: this.generation });
    this.surfaces.clear();
    this.actionCompletions.clear();
    this.emit(true);
    return this.capture;
  }

  endCapture(handle?: PerformanceAuditCaptureHandle): void {
    if (!this.capture) return;
    if (handle && handle.generation !== this.capture.generation) return;
    this.capture = null;
    this.surfaces.clear();
    this.actionCompletions.clear();
    this.generation += 1;
    this.emit(true);
  }

  registerSurface(definition: PerformanceAuditSurfaceDefinition): PerformanceAuditSurfaceHandle | null {
    if (!this.capture) return null;
    const id = definition.id.trim();
    if (!id) throw new Error('A readiness surface requires an ID');
    const at = this.clock.now();
    const instance = this.nextInstance++;
    const priorCompletion = this.actionCompletions.get(id);
    const surface: MutableSurface = {
      id,
      routeKey: nullable(definition.routeKey),
      datasetRevision: nullable(definition.datasetRevision),
      renderRevision: nullable(definition.renderRevision),
      registeredAtMs: at,
      updatedAtMs: at,
      instance,
      probes: new Map(),
      actions: actionsMap(definition.actions),
      actionRevision: priorCompletion?.actionRevision ?? 0,
      lastCompletedAction: priorCompletion?.actionName ?? null,
    };
    for (const probe of definition.probes ?? []) {
      surface.probes.set(probe.id, this.makeProbe(probe, at));
    }
    this.surfaces.set(id, surface);
    this.emit();
    return Object.freeze({ surfaceId: id, generation: this.capture.generation, instance });
  }

  updateSurface(handle: PerformanceAuditSurfaceHandle, patch: PerformanceAuditSurfacePatch): boolean {
    const surface = this.surfaceFor(handle);
    if (!surface) return false;
    const nextRouteKey = patch.routeKey === undefined ? surface.routeKey : nullable(patch.routeKey);
    const nextDatasetRevision = patch.datasetRevision === undefined
      ? surface.datasetRevision
      : nullable(patch.datasetRevision);
    const nextRenderRevision = patch.renderRevision === undefined
      ? surface.renderRevision
      : nullable(patch.renderRevision);
    const nextActions = patch.actions === undefined ? surface.actions : actionsMap(patch.actions);
    if (
      nextRouteKey === surface.routeKey &&
      nextDatasetRevision === surface.datasetRevision &&
      nextRenderRevision === surface.renderRevision &&
      mapsHaveSameActions(nextActions, surface.actions)
    ) return true;
    surface.routeKey = nextRouteKey;
    surface.datasetRevision = nextDatasetRevision;
    surface.renderRevision = nextRenderRevision;
    surface.actions = nextActions;
    surface.updatedAtMs = this.clock.now();
    this.emit();
    return true;
  }

  unregisterSurface(handle: PerformanceAuditSurfaceHandle): boolean {
    const surface = this.surfaceFor(handle);
    if (!surface) return false;
    this.surfaces.delete(handle.surfaceId);
    this.emit();
    return true;
  }

  upsertProbe(
    handle: PerformanceAuditSurfaceHandle,
    definition: PerformanceAuditProbeDefinition,
  ): boolean {
    const surface = this.surfaceFor(handle);
    if (!surface) return false;
    const id = definition.id.trim();
    if (!id) throw new Error('A readiness probe requires an ID');
    const existing = surface.probes.get(id);
    if (existing) return this.updateProbe(handle, id, definition);
    const at = this.clock.now();
    surface.probes.set(id, this.makeProbe({ ...definition, id }, at));
    surface.updatedAtMs = at;
    this.emit();
    return true;
  }

  updateProbe(
    handle: PerformanceAuditSurfaceHandle,
    probeId: string,
    patch: PerformanceAuditProbePatch,
  ): boolean {
    const surface = this.surfaceFor(handle);
    const probe = surface?.probes.get(probeId);
    if (!surface || !probe) return false;
    const status = patch.status ?? probe.status;
    const next: Omit<MutableProbe, 'id' | 'updatedAtMs'> = {
      kind: patch.kind ?? probe.kind,
      required: patch.required ?? probe.required,
      status,
      datasetRevision: patch.datasetRevision === undefined
        ? probe.datasetRevision
        : nullable(patch.datasetRevision),
      renderRevision: patch.renderRevision === undefined
        ? probe.renderRevision
        : nullable(patch.renderRevision),
      expectedCount: patch.expectedCount === undefined
        ? probe.expectedCount
        : nullableCount(patch.expectedCount),
      actualCount: patch.actualCount === undefined
        ? probe.actualCount
        : nullableCount(patch.actualCount),
      fallbackCount: patch.fallbackCount === undefined
        ? probe.fallbackCount
        : nullableCount(patch.fallbackCount),
      visibleCount: patch.visibleCount === undefined
        ? probe.visibleCount
        : nullableCount(patch.visibleCount),
      emptyStateRendered: patch.emptyStateRendered === undefined
        ? probe.emptyStateRendered
        : nullableBoolean(patch.emptyStateRendered),
      layoutMeasured: patch.layoutMeasured === undefined
        ? probe.layoutMeasured
        : nullableBoolean(patch.layoutMeasured),
      accessibleSummary: patch.accessibleSummary === undefined
        ? probe.accessibleSummary
        : nullableBoolean(patch.accessibleSummary),
      error: patch.error === undefined
        ? normalizeError(status, probe.error)
        : normalizeError(status, patch.error),
    };
    if (
      next.kind === probe.kind &&
      next.required === probe.required &&
      next.status === probe.status &&
      next.datasetRevision === probe.datasetRevision &&
      next.renderRevision === probe.renderRevision &&
      next.expectedCount === probe.expectedCount &&
      next.actualCount === probe.actualCount &&
      next.fallbackCount === probe.fallbackCount &&
      next.visibleCount === probe.visibleCount &&
      next.emptyStateRendered === probe.emptyStateRendered &&
      next.layoutMeasured === probe.layoutMeasured &&
      next.accessibleSummary === probe.accessibleSummary &&
      next.error === probe.error
    ) return true;
    Object.assign(probe, next, { updatedAtMs: this.clock.now() });
    surface.updatedAtMs = probe.updatedAtMs;
    this.emit();
    return true;
  }

  removeProbe(handle: PerformanceAuditSurfaceHandle, probeId: string): boolean {
    const surface = this.surfaceFor(handle);
    if (!surface || !surface.probes.delete(probeId)) return false;
    surface.updatedAtMs = this.clock.now();
    this.emit();
    return true;
  }

  async invokeAction(surfaceId: string, actionName: string, ...args: unknown[]): Promise<unknown> {
    const capture = this.capture;
    if (!capture) throw new Error('No readiness capture is active');
    const surface = this.surfaces.get(surfaceId);
    if (!surface) throw new Error(`Readiness surface is not registered: ${surfaceId}`);
    const action = surface.actions.get(actionName);
    if (!action) throw new Error(`Readiness action is not registered: ${surfaceId}.${actionName}`);
    const result = await action(...args);
    // Capture can end/restart while the action awaits; never stamp a newer session.
    if (this.capture?.generation !== capture.generation) return result;
    // Terminal unavailability is skip evidence, not a successful semantic action.
    if (isUnavailableActionResult(result)) return result;
    // Remounts during navigation can replace the MutableSurface instance before we
    // return. Persist completion by surface ID, then stamp whichever instance is live.
    const priorRevision = this.actionCompletions.get(surfaceId)?.actionRevision
      ?? surface.actionRevision;
    const completion: PerformanceAuditActionCompletion = {
      actionName,
      actionRevision: priorRevision + 1,
    };
    this.actionCompletions.set(surfaceId, completion);
    const live = this.surfaces.get(surfaceId) ?? surface;
    live.actionRevision = completion.actionRevision;
    live.lastCompletedAction = completion.actionName;
    live.updatedAtMs = this.clock.now();
    this.emit();
    return result;
  }

  /**
   * Return action proof even when navigation unmounted the source surface.
   * Navigation callbacks commonly replace their own screen before the runner
   * can inspect it; the capture-scoped completion ledger is the durable source
   * of truth for those actions.
   */
  actionCompletion(surfaceId: string): PerformanceAuditActionCompletion | null {
    const completion = this.actionCompletions.get(surfaceId);
    return completion ? { ...completion } : null;
  }

  snapshot(
    surfaceIds?: readonly string[],
    requiredKinds?: readonly PerformanceAuditReadinessKind[],
    onlyKinds?: readonly PerformanceAuditReadinessKind[],
  ): PerformanceAuditReadinessSnapshot {
    const selectedIds = surfaceIds ? new Set(surfaceIds) : null;
    const selectedKinds = requiredKinds ? new Set(requiredKinds) : null;
    const limitedKinds = onlyKinds?.length ? new Set(onlyKinds) : null;
    const surfaces = [...this.surfaces.values()]
      .filter((surface) => selectedIds == null || selectedIds.has(surface.id))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map<PerformanceAuditSurfaceSnapshot>((surface) => ({
        id: surface.id,
        routeKey: surface.routeKey,
        datasetRevision: surface.datasetRevision,
        renderRevision: surface.renderRevision,
        registeredAtMs: surface.registeredAtMs,
        updatedAtMs: surface.updatedAtMs,
        probes: [...surface.probes.values()]
          .sort((left, right) => left.id.localeCompare(right.id))
          .map((probe) => ({ ...probe })),
        actions: [...surface.actions.keys()].sort(),
        actionRevision: surface.actionRevision,
        lastCompletedAction: surface.lastCompletedAction,
      }));
    const blockers: PerformanceAuditReadinessBlocker[] = [];
    if (!this.capture) {
      blockers.push({ code: 'capture-inactive', message: 'No readiness capture is active' });
    } else if (surfaces.length === 0) {
      blockers.push({ code: 'no-surfaces', message: 'No readiness surfaces are registered' });
    }
    for (const surface of surfaces) {
      if (surface.probes.length === 0) {
        blockers.push({
          code: 'no-probes',
          surfaceId: surface.id,
          message: `${surface.id} has no registered readiness probes`,
        });
      }
      for (const probe of surface.probes) {
        if (limitedKinds && !limitedKinds.has(probe.kind)) continue;
        if (!limitedKinds && !probe.required && !selectedKinds?.has(probe.kind)) continue;
        if (probe.status === 'error') {
          blockers.push({
            code: 'probe-error',
            surfaceId: surface.id,
            probeId: probe.id,
            message: `${surface.id}.${probe.id} failed: ${probe.error ?? 'unknown error'}`,
          });
          continue;
        }
        if (probe.status !== 'ready') {
          blockers.push({
            code: 'probe-pending',
            surfaceId: surface.id,
            probeId: probe.id,
            message: `${surface.id}.${probe.id} is pending`,
          });
        }
        if (
          surface.datasetRevision != null &&
          probe.datasetRevision != null &&
          probe.datasetRevision !== surface.datasetRevision
        ) {
          blockers.push({
            code: 'dataset-revision-mismatch',
            surfaceId: surface.id,
            probeId: probe.id,
            message: `${surface.id}.${probe.id} has dataset revision ${probe.datasetRevision}; expected ${surface.datasetRevision}`,
          });
        }
        if (
          surface.renderRevision != null &&
          probe.renderRevision != null &&
          probe.renderRevision !== surface.renderRevision
        ) {
          blockers.push({
            code: 'render-revision-mismatch',
            surfaceId: surface.id,
            probeId: probe.id,
            message: `${surface.id}.${probe.id} has render revision ${probe.renderRevision}; expected ${surface.renderRevision}`,
          });
        }
        if (
          probe.expectedCount != null &&
          (probe.actualCount == null || probe.actualCount < probe.expectedCount)
        ) {
          blockers.push({
            code: 'count-incomplete',
            surfaceId: surface.id,
            probeId: probe.id,
            message: `${surface.id}.${probe.id} has ${probe.actualCount ?? 0} of ${probe.expectedCount} expected items`,
          });
        }
      }
    }
    for (const kind of selectedKinds ?? []) {
      if (surfaces.some((surface) => surface.probes.some((probe) => probe.kind === kind))) continue;
      blockers.push({
        code: 'required-kind-missing',
        message: `No ${kind} readiness probe is registered on the requested surface`,
      });
    }
    const probes = surfaces.flatMap((surface) => surface.probes);
    const required = probes.filter((probe) => {
      if (limitedKinds) return limitedKinds.has(probe.kind);
      return probe.required || selectedKinds?.has(probe.kind);
    });
    return {
      capturing: this.capture != null,
      sessionId: this.capture?.sessionId ?? null,
      generation: this.capture?.generation ?? this.generation,
      capturedAtMs: this.clock.now(),
      ready: this.capture != null && blockers.length === 0 && probes.length > 0,
      totalProbes: probes.length,
      requiredProbes: required.length,
      pendingRequiredProbes: new Set(
        blockers
          .filter((blocker) => blocker.probeId)
          .map((blocker) => `${blocker.surfaceId ?? ''}:${blocker.probeId ?? ''}`),
      ).size,
      surfaces,
      blockers,
      fingerprint: readinessFingerprint(this.capture?.generation ?? this.generation, surfaces),
    };
  }

  waitForReady(
    options: WaitForPerformanceAuditReadinessOptions = {},
  ): Promise<PerformanceAuditReadinessSnapshot> {
    const quietWindowMs = Math.max(0, options.quietWindowMs ?? 500);
    const timeoutMs = Math.max(1, options.timeoutMs ?? 30_000);
    const expectedGeneration = this.capture?.generation ?? null;
    return new Promise((resolve, reject) => {
      let settled = false;
      let stableFingerprint: string | null = null;
      let stableSinceMs = 0;
      let quietTimer: unknown = null;
      let timeoutTimer: unknown = null;

      const cleanup = () => {
        unsubscribe();
        if (quietTimer != null) this.clock.clearTimeout(quietTimer);
        if (timeoutTimer != null) this.clock.clearTimeout(timeoutTimer);
        options.signal?.removeEventListener('abort', abort);
      };
      const finish = (snapshot: PerformanceAuditReadinessSnapshot) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(snapshot);
      };
      const fail = (error: Error) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      };
      const scheduleQuietCheck = (delayMs: number) => {
        if (quietTimer != null) this.clock.clearTimeout(quietTimer);
        quietTimer = this.clock.setTimeout(evaluate, Math.max(0, delayMs));
      };
      const evaluate = () => {
        if (settled) return;
        quietTimer = null;
        const snapshot = this.snapshot(
          options.surfaceIds,
          options.requiredKinds,
          options.onlyKinds,
        );
        if (expectedGeneration == null || !snapshot.capturing || snapshot.generation !== expectedGeneration) {
          fail(new PerformanceAuditReadinessCaptureEndedError(snapshot));
          return;
        }
        if (snapshot.blockers.some((blocker) => blocker.code === 'probe-error')) {
          fail(new PerformanceAuditReadinessProbeError(snapshot));
          return;
        }
        // Structural gaps never recover by waiting — fail immediately with evidence.
        if (snapshot.blockers.some((blocker) => blocker.code === 'required-kind-missing')) {
          const missing = snapshot.blockers
            .filter((blocker) => blocker.code === 'required-kind-missing')
            .map((blocker) => blocker.message)
            .join('; ');
          fail(new PerformanceAuditReadinessError(
            `Required readiness kind is unavailable on the requested surface: ${missing}`,
            snapshot,
          ));
          return;
        }
        const changedRender = options.changedRender;
        const renderedChange = !changedRender || snapshot.surfaces.some((surface) =>
          surface.id === changedRender.surfaceId &&
          surface.renderRevision !== changedRender.previousRevision,
        );
        if (!snapshot.ready || !renderedChange) {
          stableFingerprint = null;
          return;
        }
        if (stableFingerprint !== snapshot.fingerprint) {
          stableFingerprint = snapshot.fingerprint;
          stableSinceMs = this.clock.now();
        }
        const stableForMs = this.clock.now() - stableSinceMs;
        if (stableForMs >= quietWindowMs) {
          finish(snapshot);
          return;
        }
        scheduleQuietCheck(quietWindowMs - stableForMs);
      };
      const abort = () => {
        fail(new PerformanceAuditReadinessError(
          'Readiness wait was aborted',
          this.snapshot(options.surfaceIds, options.requiredKinds, options.onlyKinds),
        ));
      };
      const unsubscribe = this.subscribe(evaluate);
      timeoutTimer = this.clock.setTimeout(() => {
        fail(new PerformanceAuditReadinessTimeoutError(
          timeoutMs,
          this.snapshot(options.surfaceIds, options.requiredKinds, options.onlyKinds),
        ));
      }, timeoutMs);
      options.signal?.addEventListener('abort', abort, { once: true });
      if (options.signal?.aborted) abort();
      else evaluate();
    });
  }

  private makeProbe(definition: PerformanceAuditProbeDefinition, at: number): MutableProbe {
    const id = definition.id.trim();
    if (!id) throw new Error('A readiness probe requires an ID');
    const status = definition.status ?? 'pending';
    return {
      id,
      kind: definition.kind,
      required: definition.required ?? true,
      status,
      datasetRevision: nullable(definition.datasetRevision),
      renderRevision: nullable(definition.renderRevision),
      expectedCount: nullableCount(definition.expectedCount),
      actualCount: nullableCount(definition.actualCount),
      fallbackCount: nullableCount(definition.fallbackCount),
      visibleCount: nullableCount(definition.visibleCount),
      emptyStateRendered: nullableBoolean(definition.emptyStateRendered),
      layoutMeasured: nullableBoolean(definition.layoutMeasured),
      accessibleSummary: nullableBoolean(definition.accessibleSummary),
      error: normalizeError(status, definition.error),
      updatedAtMs: at,
    };
  }

  private surfaceFor(handle: PerformanceAuditSurfaceHandle): MutableSurface | null {
    if (!this.capture || handle.generation !== this.capture.generation) return null;
    const surface = this.surfaces.get(handle.surfaceId);
    return surface?.instance === handle.instance ? surface : null;
  }

  private emit(captureChanged = false): void {
    for (const listener of this.listeners) listener();
    if (captureChanged) {
      for (const listener of this.captureListeners) listener();
    }
  }
}

export interface PerformanceAuditProbeToken {
  readonly id: string;
  readonly kind: PerformanceAuditReadinessKind;
  readonly active: boolean;
  pending(patch?: Omit<PerformanceAuditProbePatch, 'status' | 'error'>): boolean;
  ready(patch?: Omit<PerformanceAuditProbePatch, 'status' | 'error'>): boolean;
  fail(error: string, patch?: Omit<PerformanceAuditProbePatch, 'status' | 'error'>): boolean;
  update(patch: PerformanceAuditProbePatch): boolean;
  unregister(): boolean;
}

export function createPerformanceAuditProbeToken(
  registry: PerformanceAuditReadinessRegistry,
  surface: PerformanceAuditSurfaceHandle | null,
  definition: PerformanceAuditProbeDefinition,
): PerformanceAuditProbeToken {
  const active = surface != null && registry.upsertProbe(surface, definition);
  const update = (patch: PerformanceAuditProbePatch) =>
    surface != null && registry.updateProbe(surface, definition.id, patch);
  return {
    id: definition.id,
    kind: definition.kind,
    active,
    pending: (patch = {}) => update({ ...patch, status: 'pending', error: null }),
    ready: (patch = {}) => update({ ...patch, status: 'ready', error: null }),
    fail: (error, patch = {}) => update({ ...patch, status: 'error', error }),
    update,
    unregister: () => surface != null && registry.removeProbe(surface, definition.id),
  };
}

type AssetProbeOptions = Omit<PerformanceAuditProbeDefinition, 'id' | 'kind'>;

export function createPerformanceAuditLogoToken(
  registry: PerformanceAuditReadinessRegistry,
  surface: PerformanceAuditSurfaceHandle | null,
  id: string,
  options: AssetProbeOptions = {},
): PerformanceAuditProbeToken {
  return createPerformanceAuditProbeToken(registry, surface, { ...options, id, kind: 'logo' });
}

export function createPerformanceAuditGraphicToken(
  registry: PerformanceAuditReadinessRegistry,
  surface: PerformanceAuditSurfaceHandle | null,
  id: string,
  options: AssetProbeOptions = {},
): PerformanceAuditProbeToken {
  return createPerformanceAuditProbeToken(registry, surface, { ...options, id, kind: 'graphic' });
}

export function createPerformanceAuditListToken(
  registry: PerformanceAuditReadinessRegistry,
  surface: PerformanceAuditSurfaceHandle | null,
  id: string,
  expectedCount: number,
  options: AssetProbeOptions = {},
): PerformanceAuditProbeToken {
  return createPerformanceAuditProbeToken(registry, surface, {
    ...options,
    id,
    kind: 'list',
    expectedCount,
  });
}

export function createPerformanceAuditLayoutToken(
  registry: PerformanceAuditReadinessRegistry,
  surface: PerformanceAuditSurfaceHandle | null,
  id: string,
  options: AssetProbeOptions = {},
): PerformanceAuditProbeToken {
  return createPerformanceAuditProbeToken(registry, surface, { ...options, id, kind: 'layout' });
}

export const performanceAuditReadinessRegistry = new PerformanceAuditReadinessRegistry();
