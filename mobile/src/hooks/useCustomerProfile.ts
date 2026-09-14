import { useEffect, useSyncExternalStore } from 'react';
import type { CustomerProfile } from '../data/customerProfile';
import { loadCustomerProfile, updateCustomerProfile } from '../data/customerProfileStorage';

type Snapshot = { profile: CustomerProfile | null; busy: boolean; error: string | null };
let snapshot: Snapshot = { profile: null, busy: false, error: null };
const listeners = new Set<() => void>();
function emit(value: Snapshot): void { snapshot = value; listeners.forEach(fn => fn()); }
async function load(): Promise<void> {
  if (snapshot.busy) return;
  emit({ ...snapshot, busy: true, error: null });
  try { emit({ profile: await loadCustomerProfile(), busy: false, error: null }); }
  catch { emit({ profile: null, busy: false, error: 'Encrypted inputs could not be opened. Existing data has not been replaced.' }); }
}
export async function changeCustomerProfile(change: (p: CustomerProfile) => CustomerProfile): Promise<boolean> {
  if (!snapshot.profile || snapshot.busy) return false;
  emit({ ...snapshot, busy: true, error: null });
  try { emit({ profile: await updateCustomerProfile(change), busy: false, error: null }); return true; }
  catch { emit({ ...snapshot, busy: false, error: 'Inputs could not be saved. Please retry.' }); return false; }
}
export function useCustomerProfile() {
  const value = useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => snapshot, () => snapshot);
  useEffect(() => { if (!snapshot.profile && !snapshot.busy && !snapshot.error) void load(); }, []);
  return { ...value, retry: load, update: changeCustomerProfile };
}
