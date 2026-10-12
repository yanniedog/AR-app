import type { NavigationState, PartialState } from '@react-navigation/native';

interface AuditRootNavigation {
  getRootState(): NavigationState | undefined;
  resetRoot(state: NavigationState): void;
}

function activeNavigationPath(
  state: NavigationState | PartialState<NavigationState> | undefined,
  maxDepth = Infinity,
): NavigationState[] | undefined {
  const path: NavigationState[] = [];
  while (state && path.length < maxDepth) {
    if (state.stale !== false || !state.routes[state.index]) return undefined;
    path.push(state);
    state = state.routes[state.index].state;
  }
  return path;
}

/** The audit owns only routes added after this exact, mounted audit origin. */
export class PerformanceAuditNavigationAnchor {
  private readonly origin: NavigationState;
  private readonly originPath: NavigationState[];

  constructor(private readonly navigation: AuditRootNavigation, pathname: string) {
    const state = navigation.getRootState();
    const path = activeNavigationPath(state);
    const auditStack = path?.at(-1);
    if (!state || !path || pathname !== '/performance-audit' || auditStack?.type !== 'stack' ||
        auditStack.index !== auditStack.routes.length - 1 ||
        auditStack.routes[auditStack.index]?.name !== 'performance-audit') {
      throw new Error('The audit navigation origin is not the active root-stack audit screen.');
    }
    // Expo Router nests the app Stack under an internal __root container route.
    // Validate the focused leaf, but reset the complete container snapshot.
    this.originPath = path;
    // React Navigation states are immutable. Preserve route keys, parameters and
    // nested tab history, not a newly constructed route with the same pathname.
    this.origin = { ...state, routes: [...state.routes] };
  }

  restore(hasPendingMutation: boolean): void {
    if (hasPendingMutation) throw new Error('Cannot restore audit navigation while a mounted action is pending.');
    const path = activeNavigationPath(this.navigation.getRootState(), this.originPath.length);
    if (!path || path.length !== this.originPath.length || this.originPath.some((origin, index) => {
      const current = path[index];
      return current.key !== origin.key || current.type !== origin.type ||
        origin.routes.some(route => !current.routeNames.includes(route.name)) ||
        (index < this.originPath.length - 1 &&
          current.routes[current.index].key !== origin.routes[origin.index].key);
    })) {
      throw new Error('The root navigator changed; the saved audit origin cannot be safely restored.');
    }
    this.navigation.resetRoot(this.origin);
  }

  isRestored(): boolean {
    const path = activeNavigationPath(this.navigation.getRootState(), this.originPath.length);
    return path?.length === this.originPath.length && this.originPath.every((origin, index) => {
      const current = path[index];
      return current.key === origin.key && current.index === origin.index &&
        current.routes.length === origin.routes.length &&
        current.routes.every((route, routeIndex) => route.key === origin.routes[routeIndex].key);
    });
  }
}
