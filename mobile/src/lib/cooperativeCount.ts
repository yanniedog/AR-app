import { yieldToUi } from './yieldToUi';

/** Count display-only catalogue entries without a render-time scan. */
export async function countItemsCooperatively<T>(items: readonly T[], matches: (item: T) => boolean,
  control: { cancelled?: () => boolean; yieldControl?: () => Promise<void>; now?: () => number } = {},
): Promise<number | null> {
  const pause = control.yieldControl ?? (() => yieldToUi(0));
  const now = control.now ?? (() => performance.now());
  await pause();
  if (control.cancelled?.()) return null;
  let count = 0;
  let started = now();
  for (let index = 0; index < items.length; index++) {
    if (matches(items[index])) count++;
    if ((index + 1) % 32 === 0) {
      if (now() - started >= 6) { await pause(); started = now(); }
      if (control.cancelled?.()) return null;
    }
  }
  return control.cancelled?.() ? null : count;
}
