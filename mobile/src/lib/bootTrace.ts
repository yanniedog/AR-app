// Launch timeline: milliseconds since the JS runtime started, one line per launch.
// The first mark is taken when this module evaluates, so it is imported first from index.ts.

import { debugLog } from './debugLog';

const FINAL_MARK = 'rates-ready';
const marks: Record<string, number> = {};
let flushed = false;

function now(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  return Math.round(typeof perf?.now === 'function' ? perf.now() : Date.now());
}

export function bootMark(name: string): void {
  if (flushed || marks[name] !== undefined) return;
  marks[name] = now();
  if (name === FINAL_MARK) flush();
}

function flush(): void {
  flushed = true;
  const line = Object.entries(marks).map(([key, at]) => `${key}=${at}`).join(' ');
  try {
    debugLog.warn('boot', `launch ms ${line}`);
  } catch { /* Tracing is best-effort. */ }
}

/** Test hook. */
export function resetBootTraceForTests(): void {
  flushed = false;
  for (const key of Object.keys(marks)) delete marks[key];
}

bootMark('js-start');
