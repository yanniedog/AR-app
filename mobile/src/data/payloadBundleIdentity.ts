import type { Manifest } from '../types';
import { canonical, hashText } from '../lib/productTermsEngine/validation';

/** Producer preimage: byte identities stay bound when publication URLs change. */
export function payloadBundleIdentity(manifest: Manifest): string {
  const value = Object.fromEntries(Object.entries(manifest).filter(([key]) =>
    !['generated_at', 'tag', 'payload_revision', 'files'].includes(key)));
  value.files = Object.fromEntries(Object.entries(manifest.files).map(([key, file]) =>
    [key, Object.fromEntries(Object.entries(file).filter(([field]) => field !== 'url'))]));
  if (manifest.bank_rate_history_catalogue) value.bank_rate_history_catalogue = {
    ...manifest.bank_rate_history_catalogue,
    file: Object.fromEntries(Object.entries(manifest.bank_rate_history_catalogue.file).filter(([field]) => field !== 'url')),
  };
  return hashText(canonical(value));
}
