export type LogoRenderState = 'pending' | 'decoded' | 'initials' | 'unmounted';
export type LogoTerminalState = Exclude<LogoRenderState, 'pending' | 'unmounted'>;

export interface LogoReadinessSummary {
  expectedCount: number;
  terminalCount: number;
  ready: boolean;
}

export function applyLogoRenderState(
  current: ReadonlyMap<string, LogoTerminalState | null>,
  id: string,
  state: LogoRenderState,
): Map<string, LogoTerminalState | null> {
  const next = new Map(current);
  if (state === 'unmounted') next.delete(id);
  else next.set(id, state === 'pending' ? null : state);
  return next;
}

export function summarizeLogoRenderStates(
  states: ReadonlyMap<string, LogoTerminalState | null>,
  fixedExpectedIds: readonly string[] = [],
): LogoReadinessSummary {
  const expected = new Set([...fixedExpectedIds, ...states.keys()]);
  let terminalCount = 0;
  for (const id of expected) {
    if (states.get(id) != null) terminalCount += 1;
  }
  return {
    expectedCount: expected.size,
    terminalCount,
    ready: terminalCount === expected.size,
  };
}
