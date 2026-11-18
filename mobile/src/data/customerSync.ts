import { customerSyncValuesEqual, mergeCustomerSync, type SyncDocument } from './customerSyncMerge';
import type { GoogleCustomerFile } from './googleDriveCustomerFile';
import { assertGoogleRecoveryAvailable } from './googleRecovery';

export interface CustomerSyncRepository {
  /** Binding and last common snapshot are stored encrypted beside customer inputs. */
  load(): Promise<{ accountId: string | null; document: SyncDocument; base: SyncDocument }>;
  /** Admit the full customer/preferences schema before upload or restoration.
   * An empty document is the explicit never-entered installation sentinel. */
  validate(document: SyncDocument): void;
  /** Atomically compare expected under the customer-storage lock; reject on a racing edit. */
  commit(accountId: string, document: SyncDocument, base: SyncDocument, expected: SyncDocument): Promise<void>;
}
export interface CustomerSyncTransport {
  read(accountId: string): Promise<GoogleCustomerFile | null>;
  write(accountId: string, document: SyncDocument, previous: GoogleCustomerFile | null): Promise<GoogleCustomerFile>;
}
export type CustomerSyncResult = { status: 'synced'; syncedAt: string } | { status: 'conflict'; paths: string[] };

/** One serial queue per connected account. The production gate is checked before
 * touching local or remote data. Callers schedule on profile changes and foreground;
 * an offline failure leaves the encrypted local document and common base intact.
 */
export function createCustomerSync(accountId: string, repository: CustomerSyncRepository, transport: CustomerSyncTransport,
  assertAvailable = assertGoogleRecoveryAvailable,
) {
  let tail: Promise<unknown> = Promise.resolve();
  let disconnected = false;
  const active = () => { assertAvailable(); if (disconnected || !accountId) throw new Error('Google connection changed.'); };
  async function sync(choices: Readonly<Record<string, 'device' | 'google'>>): Promise<CustomerSyncResult> {
    active();
    const initial = await repository.load();
    active();
    if (initial.accountId && initial.accountId !== accountId) throw new Error('Google account changed.');
    const remote = await transport.read(accountId);
    active();
    // A deleted remote file is not an instruction to erase local financial data.
    const current = await repository.load();
    active();
    if (current.accountId && current.accountId !== accountId) throw new Error('Google account changed.');
    repository.validate(current.document);
    if (remote) repository.validate(remote.document);
    const merged = mergeCustomerSync(remote ? current.base : {}, current.document, remote?.document ?? {}, choices);
    if (merged.conflicts.length) return { status: 'conflict', paths: merged.conflicts };
    repository.validate(merged.document);
    let uploaded = remote;
    if (!remote || !customerSyncValuesEqual(remote.document, merged.document)) {
      // An entirely empty installation never creates a cloud snapshot.
      if (!remote && !Object.keys(merged.document).length) return { status: 'synced', syncedAt: new Date().toISOString() };
      uploaded = await transport.write(accountId, merged.document, remote);
    }
    active();
    const latest = await repository.load();
    active();
    if (latest.accountId && latest.accountId !== accountId) throw new Error('Google account changed.');
    // Preserve edits made while the upload was in flight; they remain dirty.
    const afterUpload = mergeCustomerSync(current.document, latest.document, merged.document);
    if (afterUpload.conflicts.length) return { status: 'conflict', paths: afterUpload.conflicts };
    repository.validate(afterUpload.document);
    active();
    await repository.commit(accountId, afterUpload.document, uploaded!.document, latest.document);
    return { status: 'synced', syncedAt: new Date().toISOString() };
  }
  return {
    run(choices: Readonly<Record<string, 'device' | 'google'>> = {}): Promise<CustomerSyncResult> {
      const work = tail.catch(() => undefined).then(() => sync(choices)); tail = work; return work;
    },
    disconnect(): void { disconnected = true; },
  };
}
