import type { NavigationState } from '@react-navigation/native';

interface AuditRootNavigation {
  getRootState(): NavigationState | undefined;
  resetRoot(state: NavigationState): void;
}

/** The audit owns only routes added after this exact, mounted audit origin. */
export class PerformanceAuditNavigationAnchor {
  private readonly origin: NavigationState;

  constructor(private readonly navigation: AuditRootNavigation, pathname: string) {
    const state = navigation.getRootState();
    if (pathname !== '/performance-audit' || state?.type !== 'stack' ||
        state.index !== state.routes.length - 1 || state.routes[state.index]?.name !== 'performance-audit') {
      throw new Error('The audit navigation origin is not the active root-stack audit screen.');
    }
    // React Navigation states are immutable. Preserve route keys, parameters and
    // nested tab history, not a newly constructed route with the same pathname.
    this.origin = { ...state, routes: [...state.routes] };
  }

  restore(hasPendingMutation: boolean): void {
    if (hasPendingMutation) throw new Error('Cannot restore audit navigation while a mounted action is pending.');
    const current = this.navigation.getRootState();
    if (!current || current.key !== this.origin.key || current.type !== 'stack' ||
        this.origin.routes.some(route => !current.routeNames.includes(route.name))) {
      throw new Error('The root navigator changed; the saved audit origin cannot be safely restored.');
    }
    this.navigation.resetRoot(this.origin);
  }

  isRestored(): boolean {
    const current = this.navigation.getRootState();
    return current?.key === this.origin.key && current.index === this.origin.index &&
      current.routes.length === this.origin.routes.length &&
      current.routes.every((route, index) => route.key === this.origin.routes[index].key);
  }
}
