import { yieldToUi } from '../lib/yieldToUi';
import { getMandatoryEligibilityRevision } from './eligibilityGate';
import { getSuitabilityRevision } from './suitabilityGate';

export interface RowWorkControl {
  cancelled?: () => boolean;
  yieldControl?: () => Promise<void>;
  now?: () => number;
}

/** Keep all row-derived outputs on the same admission revision. */
export function rowWork(control: RowWorkControl = {}) {
  const mandatory = getMandatoryEligibilityRevision(), suitability = getSuitabilityRevision();
  const now = control.now ?? (() => performance.now());
  const yieldControl = control.yieldControl ?? (() => yieldToUi(0));
  let checkpoint = now();
  return {
    cancelled: () => Boolean(control.cancelled?.()) || mandatory !== getMandatoryEligibilityRevision()
      || suitability !== getSuitabilityRevision(),
    expired: () => now() - checkpoint >= 6,
    async pause() { await yieldControl(); checkpoint = now(); },
  };
}

export async function collectRowBatches<T, U>(rows: readonly T[], collect: (batch: T[]) => U[], control: RowWorkControl = {}): Promise<U[] | null> {
  const work = rowWork(control), result: U[] = [];
  await work.pause();
  for (let offset = 0; offset < rows.length; offset += 32) {
    if (work.cancelled()) return null;
    for (const value of collect(rows.slice(offset, offset + 32))) result.push(value);
    if (work.expired()) await work.pause();
  }
  return work.cancelled() ? null : result;
}

/** Stable merge sorting without a full-array native sort CPU burst. */
export async function sortValuesCooperatively<T>(values: T[], compare: (a: T, b: T) => number,
  control: RowWorkControl = {}): Promise<T[] | null> {
  const work = rowWork(control);
  await work.pause();
  if (work.cancelled()) return null;
  let source = values.slice(), target = new Array<T>(values.length), operations = 0;
  for (let width = 1; width < source.length; width *= 2) {
    for (let start = 0; start < source.length; start += width * 2) {
      const middle = Math.min(start + width, source.length), end = Math.min(start + width * 2, source.length);
      let left = start, right = middle;
      for (let output = start; output < end; output++) {
        target[output] = right >= end || left < middle && compare(source[left], source[right]) <= 0
          ? source[left++] : source[right++];
        if (++operations % 32 === 0) {
          if (work.cancelled()) return null;
          if (work.expired()) await work.pause();
        }
      }
    }
    [source, target] = [target, source];
  }
  return work.cancelled() ? null : source;
}
