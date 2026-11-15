import type { UiChild } from '../lib/uiCopy';
import React, {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';

import {
  performanceAuditReadinessRegistry,
  type PerformanceAuditProbeDefinition,
  type PerformanceAuditProbePatch,
  type PerformanceAuditReadinessRegistry,
  type PerformanceAuditSemanticAction,
  type PerformanceAuditSurfaceDefinition,
  type PerformanceAuditSurfaceHandle,
} from '../lib/performanceAuditReadiness';

import { PerformanceAuditReadinessContext } from './performanceAuditReadinessContext';

export function PerformanceAuditReadinessProvider({
  registry = performanceAuditReadinessRegistry,
  children,
}: {
  registry?: PerformanceAuditReadinessRegistry;
  children: UiChild;
}) {
  return (
    <PerformanceAuditReadinessContext.Provider value={registry}>
      {children}
    </PerformanceAuditReadinessContext.Provider>
  );
}

export function usePerformanceAuditReadinessRegistry(): PerformanceAuditReadinessRegistry {
  return useContext(PerformanceAuditReadinessContext);
}

export interface PerformanceAuditSurfaceController {
  readonly active: boolean;
  readonly surfaceId: string;
  upsertProbe(definition: PerformanceAuditProbeDefinition): boolean;
  updateProbe(probeId: string, patch: PerformanceAuditProbePatch): boolean;
  removeProbe(probeId: string): boolean;
  setActions(actions: Readonly<Record<string, PerformanceAuditSemanticAction>>): boolean;
  getHandle(): PerformanceAuditSurfaceHandle | null;
}

/**
 * Registers one mounted route or component tree with the root readiness registry.
 * Outside an active audit capture the controller is inert and creates no probe data.
 */
export function usePerformanceAuditSurface(
  definition: PerformanceAuditSurfaceDefinition,
  enabled = true,
): PerformanceAuditSurfaceController {
  const registry = usePerformanceAuditReadinessRegistry();
  const definitionRef = useRef(definition);
  // Publish definitions only after commit; an abandoned concurrent render
  // must not replace the mounted surface's actions or evidence.
  useLayoutEffect(() => { definitionRef.current = definition; });
  const captureGeneration = useSyncExternalStore(
    registry.subscribeCapture,
    registry.getCaptureGeneration,
    registry.getCaptureGeneration,
  );
  // Each capture/owner has its own slot. Old controllers never follow the ref
  // into a replacement capture, and registration cannot trigger a second
  // render of a potentially expensive Rates/lender screen.
  const registration = useMemo(() => ({
    handle: null as PerformanceAuditSurfaceHandle | null,
    declarativeProbeIds: new Set<string>(),
    captureGeneration, surfaceId: definition.id, enabled, registry,
  }), [captureGeneration, definition.id, enabled, registry]);

  useLayoutEffect(() => {
    if (!enabled || !registry.isCapturing()) return;
    const next = registry.registerSurface(definitionRef.current);
    registration.handle = next;
    registration.declarativeProbeIds = new Set((definitionRef.current.probes ?? []).map(probe => probe.id));
    return () => {
      registration.handle = null;
      registration.declarativeProbeIds.clear();
      if (next) registry.unregisterSurface(next);
    };
  }, [enabled, registration, registry]);

  useLayoutEffect(() => {
    const handle = registration.handle;
    if (!enabled || !handle) return;
    registry.updateSurface(handle, {
      routeKey: definition.routeKey,
      work: definition.work,
      datasetRevision: definition.datasetRevision,
      renderRevision: definition.renderRevision,
      actions: definition.actions,
    });
    const probes = definition.probes ?? [];
    const nextProbeIds = new Set(probes.map(probe => probe.id));
    for (const id of registration.declarativeProbeIds) {
      if (!nextProbeIds.has(id)) registry.removeProbe(handle, id);
    }
    for (const probe of probes) registry.upsertProbe(handle, probe);
    registration.declarativeProbeIds = nextProbeIds;
  }, [definition.work, definition.actions, definition.datasetRevision, definition.probes, definition.renderRevision, definition.routeKey, enabled, registration, registry]);

  return useMemo<PerformanceAuditSurfaceController>(() => {
    const { captureGeneration, enabled, registry } = registration;
    const getHandle = () => enabled && registry.isCapturing() && registry.getCaptureGeneration() === captureGeneration
      ? registration.handle : null;
    return {
      get active() { return getHandle() != null; },
      surfaceId: registration.surfaceId,
      upsertProbe: probe => { const handle = getHandle(); return handle != null && registry.upsertProbe(handle, probe); },
      updateProbe: (probeId, patch) => { const handle = getHandle(); return handle != null && registry.updateProbe(handle, probeId, patch); },
      removeProbe: probeId => { const handle = getHandle(); return handle != null && registry.removeProbe(handle, probeId); },
      setActions: actions => { const handle = getHandle(); return handle != null && registry.updateSurface(handle, { actions }); },
      getHandle,
    };
  }, [registration]);
}

export interface PerformanceAuditProbeController {
  readonly active: boolean;
  readonly probeId: string;
  pending(patch?: Omit<PerformanceAuditProbePatch, 'status' | 'error'>): boolean;
  ready(patch?: Omit<PerformanceAuditProbePatch, 'status' | 'error'>): boolean;
  fail(error: string, patch?: Omit<PerformanceAuditProbePatch, 'status' | 'error'>): boolean;
  update(patch: PerformanceAuditProbePatch): boolean;
}

/** Registers a mounted part of the surface. Closed optional panels have no probe. */
export function usePerformanceAuditProbe(
  surface: PerformanceAuditSurfaceController,
  definition: PerformanceAuditProbeDefinition,
  enabled = true,
): PerformanceAuditProbeController {
  const definitionRef = useRef(definition);
  useLayoutEffect(() => { definitionRef.current = definition; });

  useEffect(() => {
    if (!surface.active || !enabled) return;
    const registered = definitionRef.current;
    surface.upsertProbe(registered);
    return () => {
      surface.removeProbe(registered.id);
    };
  }, [definition.id, enabled, surface]);

  useEffect(() => {
    if (surface.active && enabled) surface.upsertProbe(definition);
  }, [definition, enabled, surface]);

  return useMemo<PerformanceAuditProbeController>(() => {
    const update = (patch: PerformanceAuditProbePatch) =>
      enabled && surface.updateProbe(definition.id, patch);
    return {
      get active() { return surface.active && enabled; },
      probeId: definition.id,
      pending: (patch = {}) => update({ ...patch, status: 'pending', error: null }),
      ready: (patch = {}) => update({ ...patch, status: 'ready', error: null }),
      fail: (error, patch = {}) => update({ ...patch, status: 'error', error }),
      update,
    };
  }, [definition.id, enabled, surface]);
}

export function usePerformanceAuditLogoProbe(
  surface: PerformanceAuditSurfaceController,
  id: string,
  options: Omit<PerformanceAuditProbeDefinition, 'id' | 'kind'> = {},
): PerformanceAuditProbeController {
  return usePerformanceAuditProbe(surface, { ...options, id, kind: 'logo' });
}

export function usePerformanceAuditGraphicProbe(
  surface: PerformanceAuditSurfaceController,
  id: string,
  options: Omit<PerformanceAuditProbeDefinition, 'id' | 'kind'> = {},
): PerformanceAuditProbeController {
  return usePerformanceAuditProbe(surface, { ...options, id, kind: 'graphic' });
}

export function usePerformanceAuditListProbe(
  surface: PerformanceAuditSurfaceController,
  id: string,
  expectedCount: number,
  options: Omit<PerformanceAuditProbeDefinition, 'id' | 'kind' | 'expectedCount'> = {},
): PerformanceAuditProbeController {
  return usePerformanceAuditProbe(surface, {
    ...options,
    id,
    kind: 'list',
    expectedCount,
  });
}

export function usePerformanceAuditLayoutProbe(
  surface: PerformanceAuditSurfaceController,
  id: string,
  options: Omit<PerformanceAuditProbeDefinition, 'id' | 'kind'> = {},
): PerformanceAuditProbeController {
  return usePerformanceAuditProbe(surface, { ...options, id, kind: 'layout' });
}
