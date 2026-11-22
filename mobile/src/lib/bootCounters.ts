// Launch diagnostics counters. No imports on purpose: data modules that scripts
// load under plain Node must be able to count without pulling in app storage.

const counts: Record<string, number> = {};
let frozen = false;

/** Sum a counter (runs, yields, ms) for the launch line. Ignored once the line is written. */
export function bootCount(name: string, delta = 1): void {
  if (frozen) return;
  counts[name] = (counts[name] ?? 0) + delta;
}

/** Called when the launch line is written: stop counting and return the totals. */
export function freezeBootCounts(): [string, number][] {
  frozen = true;
  return Object.entries(counts);
}

/** Test hook. */
export function resetBootCountsForTests(): void {
  frozen = false;
  for (const key of Object.keys(counts)) delete counts[key];
}
