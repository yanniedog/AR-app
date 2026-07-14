import { InteractionManager } from 'react-native';

/** Fallback so looping progress animations cannot stall yield forever. */
const YIELD_TIMEOUT_MS = 48;

/**
 * Yield the JS thread so React can paint / handle touches before the next
 * heavy sync burst (large JSON.parse, hierarchy rebuild, file IO, etc.).
 *
 * Prefers `InteractionManager.runAfterInteractions`, but races a short timeout
 * so an active spinner/progress animation cannot deadlock the caller.
 */
export function yieldToUi(timeoutMs: number = YIELD_TIMEOUT_MS): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    InteractionManager.runAfterInteractions(finish);
    setTimeout(finish, timeoutMs);
  });
}
