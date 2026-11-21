// Launch timeline: milliseconds since the JS runtime started, one line per launch.
// The first mark is taken when this module evaluates, so it is imported first from index.ts.

import { debugLog } from './debugLog';

// The line is written once, when Rates is ready or the launch ended without data.
const FINAL_MARKS = new Set(['rates-ready', 'load-failed']);
const marks: Record<string, number> = {};
const counts: Record<string, number> = {};
let flushed = false;

function now(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  return Math.round(typeof perf?.now === 'function' ? perf.now() : Date.now());
}

export function bootMark(name: string): void {
  if (flushed || marks[name] !== undefined) return;
  marks[name] = now();
  if (FINAL_MARKS.has(name)) flush();
}

/** Sum a counter (runs, yields, ms) into the launch line. Ignored once the line is written. */
export function bootCount(name: string, delta = 1): void {
  if (flushed) return;
  counts[name] = (counts[name] ?? 0) + delta;
}

function flush(): void {
  flushed = true;
  const line = [...Object.entries(marks), ...Object.entries(counts)].map(([key, at]) => `${key}=${Math.round(at)}`).join(' ');
  try {
    debugLog.warn('boot', `launch ms ${line}`);
  } catch { /* Tracing is best-effort. */ }
}

/** Test hook. */
export function resetBootTraceForTests(): void {
  flushed = false;
  for (const key of Object.keys(marks)) delete marks[key];
  for (const key of Object.keys(counts)) delete counts[key];
}

bootMark('js-start');
