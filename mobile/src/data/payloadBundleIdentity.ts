import type { Manifest } from '../types';
import { canonical, hashText } from '../lib/productTermsEngine/validation';

/** Producer preimage: byte identities stay bound when publication URLs change. */
export function payloadBundleIdentity(manifest: Manifest): string {
  const value = Object.fromEntries(Object.entries(manifest).filter(([key]) =>
    !['generated_at', 'tag', 'payload_revision', 'files'].includes(key)));
  value.files = Object.fromEntries(Object.entries(manifest.files).map(([key, file]) =>
    [key, Object.fromEntries(Object.entries(file).filter(([field]) => field !== 'url'))]));
  const history = manifest.bank_rate_history_catalogue;
  // Unrelated capabilities still bind malformed optional metadata verbatim. Its
  // own loader validates the schema; only object descriptors have a routing URL.
  if (history && typeof history === 'object' && !Array.isArray(history)
      && history.file && typeof history.file === 'object' && !Array.isArray(history.file)) value.bank_rate_history_catalogue = {
    ...history,
    file: Object.fromEntries(Object.entries(history.file).filter(([field]) => field !== 'url')),
  };
  const publicRates = manifest.public_rate_catalogue;
  if (publicRates && typeof publicRates === 'object' && !Array.isArray(publicRates)) {
    // Routing changes during immutable publication; byte identities remain frozen.
    const withoutUrls = (file: unknown): unknown => file && typeof file === 'object' && !Array.isArray(file)
      ? Object.fromEntries(Object.entries(file).filter(([field]) => field !== 'url')) : file;
    value.public_rate_catalogue = { ...publicRates, index: withoutUrls(publicRates.index),
      shards: Array.isArray(publicRates.shards) ? publicRates.shards.map(withoutUrls) : publicRates.shards };
  }
  return hashText(canonical(value));
}
