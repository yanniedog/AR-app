export type SyncValue = null | boolean | number | string | SyncValue[] | { [key: string]: SyncValue };
export type SyncDocument = { [key: string]: SyncValue };
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);

/** Input admission also bounds resource use before traversing a downloaded document. */
export function validateSyncDocument(value: unknown): SyncDocument {
  let nodes = 0;
  const visit = (item: unknown, depth: number): boolean => {
    if (++nodes > 20_000 || depth > 24) return false;
    if (item === null || typeof item === 'boolean') return true;
    if (typeof item === 'number') return Number.isFinite(item);
    if (typeof item === 'string') return item.length <= 100_000;
    if (Array.isArray(item)) return item.every(child => visit(child, depth + 1));
    if (!item || typeof item !== 'object' || Object.getPrototypeOf(item) !== Object.prototype) return false;
    return Object.entries(item).every(([key, child]) => !forbidden.has(key) && visit(child, depth + 1));
  };
  if (!value || Array.isArray(value) || typeof value !== 'object' || !visit(value, 0)) {
    throw new Error('Invalid customer sync document.');
  }
  return value as SyncDocument;
}

const record = (value: SyncValue | undefined): value is SyncDocument =>
  !!value && typeof value === 'object' && !Array.isArray(value);
function equal(left: SyncValue | undefined, right: SyncValue | undefined): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, i) => equal(value, right[i]));
  if (record(left) && record(right)) {
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every(key => Object.hasOwn(right, key) && equal(left[key], right[key]));
  }
  return false;
}
export const customerSyncValuesEqual = equal;

/** Three-way merge; conflicts contain paths only, never private financial values.
 * Arrays are atomic because positional merging could change product identities.
 */
export function mergeCustomerSync(base: SyncDocument, device: SyncDocument, google: SyncDocument,
  choices: Readonly<Record<string, 'device' | 'google'>> = {},
): { document: SyncDocument; conflicts: string[] } {
  [base, device, google].forEach(validateSyncDocument);
  const conflicts: string[] = [];
  const merge = (before: SyncValue | undefined, local: SyncValue | undefined, remote: SyncValue | undefined, path: string): SyncValue | undefined => {
    if (equal(local, remote)) return local;
    if (equal(local, before)) return remote;
    if (equal(remote, before)) return local;
    if ((before === undefined || record(before)) && record(local) && record(remote)) {
      const result: SyncDocument = {};
      for (const key of new Set([...Object.keys(before ?? {}), ...Object.keys(local), ...Object.keys(remote)])) {
        const pointer = `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`;
        const value = merge(before?.[key], local[key], remote[key], pointer);
        if (value !== undefined) result[key] = value;
      }
      return result;
    }
    if (choices[path] === 'google') return remote;
    if (choices[path] !== 'device') conflicts.push(path);
    return local;
  };
  return { document: merge(base, device, google, '') as SyncDocument, conflicts };
}
