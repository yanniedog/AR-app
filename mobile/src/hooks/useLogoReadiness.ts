import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  applyLogoRenderState,
  summarizeLogoRenderStates,
  type LogoRenderState,
  type LogoTerminalState,
} from '../lib/logoReadiness';

export function useLogoReadiness(scopeKey: string, fixedExpectedIds: readonly string[] = []) {
  const [states, setStates] = useState<Map<string, LogoTerminalState | null>>(() => new Map());

  useEffect(() => {
    setStates(new Map());
  }, [scopeKey]);

  const onLogoRenderStateChange = useCallback((id: string, state: LogoRenderState) => {
    setStates((current) => applyLogoRenderState(current, id, state));
  }, []);
  const summary = useMemo(
    () => summarizeLogoRenderStates(states, fixedExpectedIds),
    [fixedExpectedIds, states],
  );
  return { onLogoRenderStateChange, ...summary };
}
