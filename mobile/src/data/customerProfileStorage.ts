import { Platform } from 'react-native';
import { SECURE_STORE_KEYS } from '../lib/secureStoreKey';
import { readSecureStoreValue, writeSecureStoreValue } from '../lib/secureStoreValue';
import { type CustomerProfile, validateProfile } from './customerProfile';
import { migrateCustomerProfile } from './customerProfileMigration';
import { migrateInputState, reconcileProfileAnswers } from './customerInputState';

const listeners = new Set<(profile: CustomerProfile) => void>();
export function subscribeCustomerProfile(listener: (profile: CustomerProfile) => void): () => void {
  listeners.add(listener); return () => listeners.delete(listener);
}
function publish(profile: CustomerProfile): CustomerProfile {
  // Consumer rendering must not turn an already verified storage write into a failure.
  listeners.forEach(listener => { try { listener(profile); } catch { /* Subscribers retry their own state. */ } });
  return profile;
}

let tail: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = tail.catch(() => undefined).then(work); tail = next; return next;
}
function nativeOnly(): void { if (Platform.OS === 'web') throw new Error('Customer inputs are available only in the installed app.'); }
async function load(): Promise<CustomerProfile> {
  nativeOnly();
  const current = await readSecureStoreValue(SECURE_STORE_KEYS.customerProfile, { preserveIncomplete: true });
  const existing = current !== null ? validateProfile(JSON.parse(current)) : null;
  if (existing?.inputState) return existing;
  const legacy = await readSecureStoreValue(SECURE_STORE_KEYS.userRateScenario, { preserveIncomplete: true });
  const source = legacy === null ? null : JSON.parse(legacy);
  const comparison = await readSecureStoreValue(SECURE_STORE_KEYS.mortgageComparisonProfile, { preserveIncomplete: true });
  const base = existing ?? migrateCustomerProfile(source);
  const migrated = validateProfile({ ...base, inputState: migrateInputState(base, source, comparison === null ? null : JSON.parse(comparison)) });
  const encoded = JSON.stringify(migrated);
  await writeSecureStoreValue(SECURE_STORE_KEYS.customerProfile, encoded);
  if (await readSecureStoreValue(SECURE_STORE_KEYS.customerProfile, { preserveIncomplete: true }) !== encoded) throw new Error('Customer profile write could not be verified.');
  // Never delete, rewrite or mark the existing scenario migrated.
  return publish(migrated);
}
export function loadCustomerProfile(): Promise<CustomerProfile> { return serial(load); }
export function updateCustomerProfile(change: (current: CustomerProfile) => CustomerProfile): Promise<CustomerProfile> {
  return serial(async () => {
    const current = await load();
    const next = validateProfile({ ...reconcileProfileAnswers(current, change(current)), revision: current.revision + 1 });
    const encoded = JSON.stringify(next);
    await writeSecureStoreValue(SECURE_STORE_KEYS.customerProfile, encoded);
    if (await readSecureStoreValue(SECURE_STORE_KEYS.customerProfile, { preserveIncomplete: true }) !== encoded) throw new Error('Customer profile write could not be verified.');
    return publish(next);
  });
}
