/** Shared optional-lane admission: one active product, four bounded waiters, two indexes. */
import { EvidenceError, type EvidenceIndex } from './productEvidenceWire';

type Waiter = { start: () => void; signal?: AbortSignal; abort: () => void };
const waiting: Waiter[] = [], indexes = new Map<object, EvidenceIndex>();
let active = false;

export async function reserveEvidence(signal?: AbortSignal): Promise<() => void> {
  if (signal?.aborted) throw new EvidenceError('cancelled', 'Evidence request cancelled');
  if (!active) active = true;
  else {
    if (waiting.length >= 4) throw new EvidenceError('unavailable', 'Evidence work capacity occupied');
    await new Promise<void>((resolve, reject) => {
      const waiter: Waiter = { signal, start: resolve, abort: () => {
        const position = waiting.indexOf(waiter);
        if (position >= 0) waiting.splice(position, 1);
        reject(new EvidenceError('cancelled', 'Evidence request cancelled'));
      } };
      waiting.push(waiter); signal?.addEventListener('abort', waiter.abort, { once: true });
    });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const next = waiting.shift();
    if (next) { next.signal?.removeEventListener('abort', next.abort); next.start(); }
    else active = false;
  };
}

export function evidenceIndex(key: object, value?: EvidenceIndex): EvidenceIndex | undefined {
  const current = value ?? indexes.get(key);
  if (current) {
    indexes.delete(key); indexes.set(key, current);
    while (indexes.size > 2) indexes.delete(indexes.keys().next().value!);
  }
  return current;
}

export function forgetEvidenceIndex(key: object): void { indexes.delete(key); }
