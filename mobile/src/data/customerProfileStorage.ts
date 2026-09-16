import { Platform } from 'react-native';
import { SECURE_STORE_KEYS } from '../lib/secureStoreKey';
import { readSecureStoreValue, writeSecureStoreValue } from '../lib/secureStoreValue';
import { type CustomerProfile, validateProfile } from './customerProfile';
import { migrateCustomerProfile } from './customerProfileMigration';

let tail: Promise<unknown> = Promise.resolve();
function serial<T>(work: () => Promise<T>): Promise<T> {
  const next = tail.catch(() => undefined).then(work); tail = next; return next;
}
function nativeOnly(): void { if (Platform.OS === 'web') throw new Error('Customer inputs are available only in the installed app.'); }
async function load(): Promise<CustomerProfile> {
  nativeOnly();
  const current = await readSecureStoreValue(SECURE_STORE_KEYS.customerProfile, { preserveIncomplete: true });
  if (current !== null) return validateProfile(JSON.parse(current));
  const legacy = await readSecureStoreValue(SECURE_STORE_KEYS.userRateScenario, { preserveIncomplete: true });
  const migrated = validateProfile(migrateCustomerProfile(legacy === null ? null : JSON.parse(legacy)));
  const encoded = JSON.stringify(migrated);
  await writeSecureStoreValue(SECURE_STORE_KEYS.customerProfile, encoded);
  if (await readSecureStoreValue(SECURE_STORE_KEYS.customerProfile, { preserveIncomplete: true }) !== encoded) throw new Error('Customer profile write could not be verified.');
  // Never delete, rewrite or mark the existing scenario migrated.
  return migrated;
}
export function loadCustomerProfile(): Promise<CustomerProfile> { return serial(load); }
export function updateCustomerProfile(change: (current: CustomerProfile) => CustomerProfile): Promise<CustomerProfile> {
  return serial(async () => {
    const current = await load();
    const next = validateProfile({ ...change(current), revision: current.revision + 1 });
    const encoded = JSON.stringify(next);
    await writeSecureStoreValue(SECURE_STORE_KEYS.customerProfile, encoded);
    if (await readSecureStoreValue(SECURE_STORE_KEYS.customerProfile, { preserveIncomplete: true }) !== encoded) throw new Error('Customer profile write could not be verified.');
    return next;
  });
}
