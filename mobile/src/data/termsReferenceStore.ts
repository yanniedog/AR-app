import { utf8ToBytes } from '@noble/hashes/utils';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { canonicalTermsJson, validateProductTerms, type ProductTerms } from './productTerms';
import { hashText } from '../lib/productTermsEngine/validation';

const MAX_BYTES = 2 * 1024 * 1024, MAX_ENTRY_BYTES = 256 * 1024, MAX_ENTRIES = 16;
const bytes = (text: string) => utf8ToBytes(text).length;
export interface TermsReference {
  productKey: string; edition: string; runDate: string; indexSha256: string; assetSha256: string;
  terms: ProductTerms; retainedAt: string;
}
interface Envelope { schemaVersion: 1; sequence: number; entries: TermsReference[]; sha256: string }
export interface ReferenceStorage { read(slot: number): Promise<string | null>; write(slot: number, text: string): Promise<void> }
function validEntry(value: TermsReference): boolean {
  try {
    if (!value || !/^[a-f0-9]{64}$/.test(value.edition) || !/^[a-f0-9]{64}$/.test(value.indexSha256) ||
        !/^[a-f0-9]{64}$/.test(value.assetSha256) || !/^\d{4}-\d{2}-\d{2}$/.test(value.runDate) ||
        !Number.isFinite(Date.parse(value.retainedAt)) || bytes(canonicalTermsJson(value)) > MAX_ENTRY_BYTES) return false;
    const { identity_sha256, ...body } = validateProductTerms(value.terms, value.productKey);
    return hashText(canonicalTermsJson(body)) === identity_sha256;
  } catch { return false; }
}
function decode(text: string | null): Envelope | null {
  try {
    if (!text || bytes(text) > MAX_BYTES) return null;
    const value = JSON.parse(text) as Envelope, { sha256, ...body } = value;
    return value.schemaVersion === 1 && Number.isSafeInteger(value.sequence) && value.sequence >= 0 &&
      Array.isArray(value.entries) && value.entries.length <= MAX_ENTRIES && value.entries.every(validEntry) &&
      hashText(canonicalTermsJson(body)) === sha256 ? value : null;
  } catch { return null; }
}
/** Two fixed slots: an interrupted replacement leaves the previous complete slot intact. */
export function createTermsReferenceStore(storage: ReferenceStorage) {
  let queue: Promise<unknown> = Promise.resolve();
  async function latest() {
    const values = await Promise.all([0, 1].map(async slot => ({ slot, value: decode(await storage.read(slot).catch(() => null)) })));
    return values.filter(item => item.value).sort((a, b) => b.value!.sequence - a.value!.sequence)[0] ?? null;
  }
  return {
    async previous(productKey: string, edition: string, indexSha256?: string): Promise<TermsReference | null> {
      await queue.catch(() => undefined);
      const current = await latest();
      const entries = current?.value?.entries.filter(entry => entry.productKey === productKey) ?? [];
      return entries.find(entry => entry.edition === edition && (!indexSha256 || entry.indexSha256 === indexSha256)) ?? entries[0] ?? null;
    },
    retain(entry: TermsReference): Promise<void> {
      const run = queue.catch(() => undefined).then(async () => {
        if (!validEntry(entry)) throw new Error('Invalid descriptive reference');
        const old = await latest(), sequence = (old?.value?.sequence ?? 0) + 1;
        if (!Number.isSafeInteger(sequence)) throw new Error('Reference sequence unavailable');
        const entries = [entry, ...(old?.value?.entries ?? []).filter(item => item.productKey !== entry.productKey || item.edition !== entry.edition || item.indexSha256 !== entry.indexSha256)].slice(0, MAX_ENTRIES);
        const encode = () => { const body = { schemaVersion: 1, sequence, entries }; return canonicalTermsJson({ ...body, sha256: hashText(canonicalTermsJson(body)) }); };
        let text = encode(); while (bytes(text) > MAX_BYTES && entries.length > 1) { entries.pop(); text = encode(); }
        if (bytes(text) > MAX_BYTES) throw new Error('Descriptive reference exceeds storage budget');
        const slot = old?.slot === 0 ? 1 : 0;
        await storage.write(slot, text);
        if (await storage.read(slot) !== text) throw new Error('Descriptive reference readback failed');
      });
      queue = run; return run;
    },
  };
}
const path = (slot: number) => `${FileSystem.documentDirectory}terms-reference-${slot}.json`;
const references = createTermsReferenceStore({
  async read(slot) {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(`ar-terms-reference-${slot}`) ?? null;
    const info = await FileSystem.getInfoAsync(path(slot));
    if (!info.exists || info.isDirectory || info.size > MAX_BYTES) return null;
    return FileSystem.readAsStringAsync(path(slot));
  },
  async write(slot, text) {
    if (Platform.OS === 'web') { globalThis.localStorage?.setItem(`ar-terms-reference-${slot}`, text); return; }
    await FileSystem.writeAsStringAsync(path(slot), text);
  },
});
export const retainTermsReference = references.retain;
export const previousTermsReference = references.previous;
