import { useCallback, useMemo, useState } from 'react';
import { usePerformanceAuditSurface } from './usePerformanceAuditReadiness';

const routeEntryMarker = () => undefined;

export function useAuditStaticRoute({ action, route, surface }: {
  action: 'about.open' | 'notices.open' | 'calculation-receipt.open';
  route: string;
  surface: string;
}) {
  const [contentMeasured, setContentMeasured] = useState(false);
  const actions = useMemo(() => ({ [action]: routeEntryMarker }), [action]);
  usePerformanceAuditSurface({
    id: surface,
    routeKey: route,
    renderRevision: surface,
    actions,
    probes: [{
      id: `${surface}.content`,
      kind: 'data',
      status: contentMeasured ? 'ready' : 'pending',
      expectedCount: 1,
      actualCount: Number(contentMeasured),
    }, {
      id: `${surface}.layout`,
      kind: 'layout',
      status: contentMeasured ? 'ready' : 'pending',
      layoutMeasured: contentMeasured,
    }],
  });
  return useCallback((width: number, height: number) => setContentMeasured(width > 0 && height > 0), []);
}
