import { InteractionManager } from 'react-native';

/** Fallback so looping progress animations cannot stall yield forever. */
const YIELD_TIMEOUT_MS = 48;

/** Payloads at or above this size yield before synchronous JSON.parse. */
export const HEAVY_JSON_BYTES = 256 * 1024;

function armTimeout(ms: number, cb: () => void): ReturnType<typeof setTimeout> {
  const handle = setTimeout(cb, ms);
  // Avoid keeping Jest (and the RN runtime) alive when a yield outlives a test.
  const maybeTimer = handle as ReturnType<typeof setTimeout> & { unref?: () => void };
  maybeTimer.unref?.();
  return handle;
}

function nextMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    armTimeout(0, resolve);
  });
}

/** Schedule work after navigation/gesture interactions and return a blur-safe cancellation. */
export function scheduleAfterInteractions(work: () => void): () => void {
  let cancelled = false;
  const handle = InteractionManager.runAfterInteractions(() => {
    if (!cancelled) work();
  });
  return () => {
    cancelled = true;
    handle.cancel?.();
  };
}

/**
 * Yield the JS thread so React can paint / handle touches before the next
 * heavy sync burst (large JSON.parse, hierarchy rebuild, file IO, etc.).
 *
 * 1. Flush one macrotask so already-queued tab/Settings presses can run.
 * 2. Then wait for `InteractionManager.runAfterInteractions`, racing a short
 *    timeout so an active spinner cannot deadlock — without letting the
 *    zero-delay timer preempt an in-flight gesture/transition.
 */
export async function yieldToUi(timeoutMs: number = YIELD_TIMEOUT_MS): Promise<void> {
  await nextMacrotask();
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    armTimeout(Math.max(0, timeoutMs), finish);
    try {
      InteractionManager.runAfterInteractions(finish);
    } catch {
      finish();
    }
  });
}

/**
 * Yield once per frame-budget slice for `frames` iterations so queued user
 * input is drained before a long synchronous burst.
 */
export async function yieldToUiFrames(
  frames: number = 2,
  timeoutMs: number = YIELD_TIMEOUT_MS,
): Promise<void> {
  const n = Math.max(1, Math.floor(frames));
  for (let i = 0; i < n; i++) {
    await yieldToUi(timeoutMs);
  }
}

/**
 * Parse JSON only after yielding so tab/Settings taps queued ahead of this
 * call are never blocked by the upcoming parse. Large payloads yield twice.
 *
 * Note: `JSON.parse` itself remains synchronous (Hermes has no async parser);
 * callers must still keep post-parse work chunked via {@link yieldToUi}.
 */
export async function parseJsonHeavy<T>(text: string): Promise<T> {
  if (text.length >= HEAVY_JSON_BYTES) {
    await yieldToUiFrames(2);
  } else {
    await yieldToUi();
  }
  return JSON.parse(text) as T;
}
