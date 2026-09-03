import { useCallback, useMemo, useState } from 'react';

import {
  applyLogoRenderState,
  summarizeLogoRenderStates,
  type LogoRenderState,
  type LogoTerminalState,
} from '../lib/logoReadiness';

const EMPTY_LOGO_STATES = new Map<string, LogoTerminalState | null>();

export function useLogoReadiness(scopeKey: string, fixedExpectedIds: readonly string[] = []) {
  const [snapshot, setSnapshot] = useState<{
    scopeKey: string;
    states: Map<string, LogoTerminalState | null>;
  }>(() => ({ scopeKey, states: new Map() }));
  // A scope can change while the same BankAvatar remains mounted with the same
  // terminal image state. Derive an empty current view synchronously, then give
  // the child a scope-bound callback so its effect re-emits that terminal state.
  // Resetting in an effect with a stable callback loses that re-emission and can
  // leave an already-rendered logo reported as pending forever.
  const states = snapshot.scopeKey === scopeKey ? snapshot.states : EMPTY_LOGO_STATES;

  const onLogoRenderStateChange = useCallback((id: string, state: LogoRenderState) => {
    setSnapshot((current) => ({
      scopeKey,
      states: applyLogoRenderState(
        current.scopeKey === scopeKey ? current.states : new Map(),
        id,
        state,
      ),
    }));
  }, [scopeKey]);
  const summary = useMemo(
    () => summarizeLogoRenderStates(states, fixedExpectedIds),
    [fixedExpectedIds, states],
  );
  return { onLogoRenderStateChange, ...summary };
}
