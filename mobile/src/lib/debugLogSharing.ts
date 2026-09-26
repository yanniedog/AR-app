import * as Clipboard from 'expo-clipboard';

import {
  debugLog,
  deleteDebugLogUpload,
  formatVersionedLogExport,
  loadDebugLogUploadReceipts,
  saveDebugLogUploadReceipt,
  uploadDebugLog,
  verifyDebugLogUpload,
  type DebugLogUploadReceipt,
} from './debugLog';

export interface DebugLogUploadSnapshot {
  sessionId: string | null;
  phase: 'idle' | 'preparing' | 'uploading' | 'verifying' | 'copying' | 'copied' | 'failed';
  url: string | null;
  verified: boolean;
  error: string | null;
  /** Retain deletion access in memory if secure storage and cleanup both fail. */
  recoveryReceipt: DebugLogUploadReceipt | null;
}

interface UploadRequest {
  sessionId: string | null;
  appVersion: string;
  buildVersion: string;
  audit?: { summaryMarker: string; report: unknown };
}

let snapshot: DebugLogUploadSnapshot = {
  sessionId: null, phase: 'idle', url: null, verified: false, error: null, recoveryReceipt: null,
};
const listeners = new Set<() => void>();
let inFlight: Promise<DebugLogUploadSnapshot> | null = null;
let lastRequest: UploadRequest | null = null;
let preparedBody: string | null = null;
let pendingReceipt: DebugLogUploadReceipt | null = null;
let lastAuditSession: string | null = null;

export const getDebugLogUploadSnapshot = () => snapshot;
export function subscribeDebugLogUpload(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function isDebugLogUploadBusy(): boolean {
  return ['preparing', 'uploading', 'verifying', 'copying'].includes(snapshot.phase);
}
function update(patch: Partial<DebugLogUploadSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

async function executeUpload(): Promise<DebugLogUploadSnapshot> {
  try {
    if (!pendingReceipt) {
      update({ phase: 'preparing', error: null });
      // Read before creating a public copy, so a storage failure cannot orphan it.
      await loadDebugLogUploadReceipts();
      const request = lastRequest!;
      preparedBody = formatVersionedLogExport(
        await debugLog.readCompleteText(request.audit), request.appVersion, request.buildVersion,
      );
      update({ phase: 'uploading' });
      const result = await uploadDebugLog(preparedBody);
      const receipt: DebugLogUploadReceipt = {
        schemaVersion: 1, url: result.url, provider: result.provider,
        ...(result.deleteKey ? { deleteKey: result.deleteKey } : {}),
        createdAt: new Date().toISOString(),
      };
      try {
        pendingReceipt = await saveDebugLogUploadReceipt(result);
      } catch {
        // Never delete older pastes to make room for a new one. Only clean up
        // this new copy if its deletion capability cannot be stored.
        try {
          await deleteDebugLogUpload(receipt.url, receipt.deleteKey);
        } catch {
          pendingReceipt = receipt;
          update({ url: receipt.url, recoveryReceipt: receipt });
          throw new Error('The deletion receipt could not be saved. Use Delete uploaded log in Debug log before trying again.');
        }
        throw new Error('The new paste was removed because its deletion receipt could not be saved. The full log is still available locally.');
      }
      update({ url: pendingReceipt.url });
      if (result.truncated || result.clientTruncated) {
        throw new Error('The paste service did not accept the complete log.');
      }
    }
    if (snapshot.recoveryReceipt) {
      throw new Error('Delete the upload with the unsaved deletion receipt from Debug log before trying again.');
    }
    if (!snapshot.verified) {
      update({ phase: 'verifying', error: null });
      await verifyDebugLogUpload(pendingReceipt, preparedBody!);
      update({ verified: true });
    }
    update({ phase: 'copying', error: null });
    const copied = await Clipboard.setStringAsync(pendingReceipt.url);
    if (copied === false) throw new Error('Clipboard write was refused.');
    update({ phase: 'copied' });
    preparedBody = null;
  } catch (error) {
    update({
      phase: 'failed',
      error: snapshot.verified
        ? 'The full log was uploaded and verified, but the link could not be copied. Tap Copy link to try again.'
        : error instanceof Error ? error.message : 'The full log could not be uploaded. Try again or share the local log.',
    });
    debugLog.warn('debugLogUpload', snapshot.error ?? 'Upload failed');
  }
  return snapshot;
}

function run(): Promise<DebugLogUploadSnapshot> {
  inFlight = executeUpload().finally(() => { inFlight = null; });
  return inFlight;
}

/** Single flight shared by the audit runner and manual upload screen. */
export function startDebugLogUpload(request: UploadRequest): Promise<DebugLogUploadSnapshot> {
  if (inFlight) return inFlight;
  if (request.sessionId && request.sessionId === lastAuditSession) return Promise.resolve(snapshot);
  if (snapshot.recoveryReceipt) {
    // A later audit must still show why its automatic upload is blocked.
    // Keep the existing deletion capability until the user removes that copy.
    update({ sessionId: request.sessionId, phase: 'failed' });
    return Promise.resolve(snapshot);
  }
  lastRequest = request;
  if (request.sessionId) lastAuditSession = request.sessionId;
  preparedBody = null;
  pendingReceipt = null;
  update({ sessionId: request.sessionId, phase: 'preparing', url: null, verified: false, error: null });
  return run();
}

/** Retry a known link's verification/copy without creating another public paste. */
export function retryDebugLogUpload(): Promise<DebugLogUploadSnapshot> {
  if (inFlight) return inFlight;
  if (!lastRequest) return Promise.resolve(snapshot);
  return run();
}

export function forgetDeletedDebugLogUpload(url: string): void {
  if (snapshot.url !== url) return;
  pendingReceipt = null;
  preparedBody = null;
  update({ phase: 'idle', url: null, verified: false, error: null, recoveryReceipt: null });
}
