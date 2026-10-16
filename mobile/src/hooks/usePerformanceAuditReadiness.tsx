import type { UiChild } from '../lib/uiCopy';
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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

const PerformanceAuditReadinessContext = createContext<PerformanceAuditReadinessRegistry>(
  performanceAuditReadinessRegistry,
);

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
  definitionRef.current = definition;
  const captureGeneration = useSyncExternalStore(
    registry.subscribeCapture,
    registry.getCaptureGeneration,
    registry.getCaptureGeneration,
  );
  const [handle, setHandle] = useState<PerformanceAuditSurfaceHandle | null>(null);

  useEffect(() => {
    if (!enabled || !registry.isCapturing()) {
      setHandle(null);
      return;
    }
    const next = registry.registerSurface(definitionRef.current);
    setHandle(next);
    return () => {
      if (next) registry.unregisterSurface(next);
    };
  }, [captureGeneration, definition.id, enabled, registry]);

  useEffect(() => {
    if (!enabled || !handle) return;
    registry.updateSurface(handle, {
      routeKey: definition.routeKey,
      datasetRevision: definition.datasetRevision,
      renderRevision: definition.renderRevision,
      actions: definition.actions,
    });
    for (const probe of definition.probes ?? []) registry.upsertProbe(handle, probe);
  }, [definition.actions, definition.datasetRevision, definition.probes, definition.renderRevision, definition.routeKey, enabled, handle, registry]);

  return useMemo<PerformanceAuditSurfaceController>(() => ({
    active: enabled && handle != null,
    surfaceId: definition.id,
    upsertProbe: (probe) => enabled && handle != null && registry.upsertProbe(handle, probe),
    updateProbe: (probeId, patch) => enabled && handle != null && registry.updateProbe(handle, probeId, patch),
    removeProbe: (probeId) => enabled && handle != null && registry.removeProbe(handle, probeId),
    setActions: (actions) => enabled && handle != null && registry.updateSurface(handle, { actions }),
    getHandle: () => enabled ? handle : null,
  }), [definition.id, enabled, handle, registry]);
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
  definitionRef.current = definition;

  useEffect(() => {
    if (!surface.active || !enabled) return;
    surface.upsertProbe(definitionRef.current);
    return () => {
      surface.removeProbe(definitionRef.current.id);
    };
  }, [definition.id, enabled, surface]);

  useEffect(() => {
    if (surface.active && enabled) surface.upsertProbe(definition);
  }, [definition, enabled, surface]);

  return useMemo<PerformanceAuditProbeController>(() => {
    const update = (patch: PerformanceAuditProbePatch) =>
      enabled && surface.updateProbe(definition.id, patch);
    return {
      active: surface.active && enabled,
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
