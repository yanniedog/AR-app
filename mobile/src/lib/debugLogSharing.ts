import * as Clipboard from 'expo-clipboard';
import { publicDebugLogUploadText } from './publicDebugLogUploadText';
import { publicReportUploadAttempt, publicReportUploadUncertain, recordPublicReportUploadAttempt } from './publicReportUploadAttempt';

import {
  debugLog,
  deleteDebugLogUpload,
  formatVersionedLogExport,
  loadDebugLogUploadReceipts,
  markDebugLogUploadReceiptVerified,
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
  /** A lost POST response may have left an unknown public copy. */
  mayHaveUploaded: boolean;
  preparationFailed?: boolean;
}

interface UploadRequest {
  sessionId: string | null;
  appVersion: string;
  buildVersion: string;
  audit?: { summaryMarker: string; report: unknown };
  /** Prepared by diagnosticsEnvelope's allowlist, never by a raw log export. */
  publicReport?: { body: string; contentSha256: string };
}

let snapshot: DebugLogUploadSnapshot = {
  sessionId: null, phase: 'idle', url: null, verified: false, error: null, recoveryReceipt: null,
  mayHaveUploaded: false,
};
const listeners = new Set<() => void>();
let inFlight: Promise<DebugLogUploadSnapshot> | null = null;
let lastRequest: UploadRequest | null = null;
let preparedBody: string | null = null;
let pendingReceipt: DebugLogUploadReceipt | null = null;
let lastAuditSession: string | null = null;
let blockedRequest: UploadRequest | null = null;
let queuedAuditRequest: UploadRequest | null = null;
let duplicateRiskAccepted = false;

export const getDebugLogUploadSnapshot = () => snapshot;
export function subscribeDebugLogUpload(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function isDebugLogUploadBusy(): boolean {
  return ['preparing', 'uploading', 'verifying', 'copying'].includes(snapshot.phase);
}
export function failPublicReportPreparation(sessionId: string): void {
  if (inFlight) return;
  // A report failure must never leave Retry bound to a previous raw-log request.
  lastRequest = null;
  lastAuditSession = null;
  blockedRequest = null;
  queuedAuditRequest = null;
  preparedBody = null;
  pendingReceipt = null;
  update({ sessionId, phase: 'failed', url: snapshot.recoveryReceipt?.url ?? null, verified: false, mayHaveUploaded: false,
    preparationFailed: true,
    error: 'The deidentified report could not be prepared. The completed report remains on this device.' });
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
      const receipts = await loadDebugLogUploadReceipts();
      const request = lastRequest!;
      preparedBody = request.publicReport?.body ?? formatVersionedLogExport(
        publicDebugLogUploadText(await debugLog.readCompleteText(request.audit)), request.appVersion, request.buildVersion,
      );
      const hash = request.publicReport?.contentSha256;
      pendingReceipt = hash ? receipts.find(receipt => receipt.contentSha256 === hash) ?? null : null;
      if (pendingReceipt) {
        update({ url: pendingReceipt.url, verified: pendingReceipt.verified === true });
      } else {
        if (hash) {
          if (!duplicateRiskAccepted && await publicReportUploadUncertain(hash)) {
            throw Object.assign(new Error('The earlier upload result was not confirmed.'), { mayHaveUploaded: true });
          }
          // Durably record intent BEFORE POST; a restart must not create another copy.
          await recordPublicReportUploadAttempt(hash, 'pending');
        }
        update({ phase: 'uploading' });
        let result: Awaited<ReturnType<typeof uploadDebugLog>>;
        try { result = await uploadDebugLog(preparedBody); }
        catch (error) {
          const uncertain = error instanceof Error && 'mayHaveUploaded' in error && error.mayHaveUploaded === true;
          if (hash && !uncertain) await recordPublicReportUploadAttempt(hash, 'failed');
          throw error;
        }
        const receipt: DebugLogUploadReceipt = {
          schemaVersion: 1, url: result.url, provider: result.provider,
          ...(result.deleteKey ? { deleteKey: result.deleteKey } : {}),
          createdAt: new Date().toISOString(),
        };
        try {
          pendingReceipt = hash
            ? await saveDebugLogUploadReceipt(result, undefined, hash)
            : await saveDebugLogUploadReceipt(result);
        } catch {
          // Never delete older pastes to make room for a new one. Only clean up
          // this new copy if its deletion capability cannot be stored.
          try {
            await deleteDebugLogUpload(receipt.url, receipt.deleteKey);
            if (hash) await recordPublicReportUploadAttempt(hash, 'failed');
          } catch {
            pendingReceipt = receipt;
            update({ url: receipt.url, recoveryReceipt: receipt });
            throw new Error('The deletion receipt could not be saved. Use Delete uploaded log in Debug log before trying again.');
          }
          throw new Error('The new paste was removed because its deletion receipt could not be saved. The full log is still available locally.');
        }
        if (hash) await recordPublicReportUploadAttempt(hash, null);
        update({ url: pendingReceipt.url });
        if (result.truncated || result.clientTruncated) {
          throw new Error('The paste service did not accept the complete log.');
        }
      }
    }
    if (snapshot.recoveryReceipt) {
      throw new Error('Delete the upload with the unsaved deletion receipt from Debug log before trying again.');
    }
    if (!snapshot.verified) {
      update({ phase: 'verifying', error: null });
      await verifyDebugLogUpload(pendingReceipt, preparedBody!);
      pendingReceipt = await markDebugLogUploadReceiptVerified(pendingReceipt);
      update({ verified: true });
    }
    update({ phase: 'copying', error: null });
    const copied = await Clipboard.setStringAsync(pendingReceipt.url);
    if (copied === false) throw new Error('Clipboard write was refused.');
    update({ phase: 'copied' });
    preparedBody = null;
  } catch (error) {
    const mayHaveUploaded = error instanceof Error &&
      'mayHaveUploaded' in error && error.mayHaveUploaded === true;
    update({
      phase: 'failed',
      mayHaveUploaded,
      error: snapshot.verified
        ? 'The compact log was uploaded and verified, but the link could not be copied. Tap Copy link to try again.'
        : mayHaveUploaded
          ? `${error.message} A public copy may already exist without a saved deletion receipt. Upload another copy only if you accept that risk.`
        : error instanceof Error ? error.message : 'The compact log could not be uploaded. Try again or share the local log.',
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
export function startDebugLogUpload(
  request: UploadRequest,
  options: { acceptDuplicateRisk?: boolean } = {},
): Promise<DebugLogUploadSnapshot> {
  if (inFlight) {
    if (request.sessionId && request.sessionId !== snapshot.sessionId) {
      // A manual upload can start during the completed audit's final flush.
      // Retain the latest finished audit and share it once that flight settles.
      queuedAuditRequest = request;
      return inFlight.then(() => {
        if (queuedAuditRequest !== request) return snapshot;
        queuedAuditRequest = null;
        return startDebugLogUpload(request);
      });
    }
    return inFlight;
  }
  if (request.sessionId && request.sessionId === lastAuditSession && request.sessionId === snapshot.sessionId) return Promise.resolve(snapshot);
  if (snapshot.recoveryReceipt) {
    // A later audit must still show why its automatic upload is blocked.
    // Keep the existing deletion capability until the user removes that copy.
    blockedRequest = request;
    update({ sessionId: request.sessionId, phase: 'failed' });
    return Promise.resolve(snapshot);
  }
  if (!request.sessionId && snapshot.mayHaveUploaded && !options.acceptDuplicateRisk) {
    lastRequest = request;
    update({ sessionId: request.sessionId, phase: 'failed' });
    return Promise.resolve(snapshot);
  }
  lastRequest = request;
  duplicateRiskAccepted = options.acceptDuplicateRisk === true;
  blockedRequest = null;
  if (request.sessionId) lastAuditSession = request.sessionId;
  preparedBody = null;
  pendingReceipt = null;
  update({ sessionId: request.sessionId, phase: 'preparing', url: null, verified: false, error: null, mayHaveUploaded: false,
    preparationFailed: false });
  return run();
}

/** Reuse known links; an ambiguous POST requires explicit duplicate-risk acknowledgement. */
export function retryDebugLogUpload(options: { acceptDuplicateRisk?: boolean } = {}): Promise<DebugLogUploadSnapshot> {
  if (inFlight) return inFlight;
  if (!lastRequest) return Promise.resolve(snapshot);
  if (snapshot.mayHaveUploaded && !options.acceptDuplicateRisk) return Promise.resolve(snapshot);
  duplicateRiskAccepted = options.acceptDuplicateRisk === true;
  update({ mayHaveUploaded: false });
  return run();
}

/** Restore known report status without network or clipboard writes. */
export async function restorePublicReportUpload(request: UploadRequest): Promise<void> {
  if (!request.publicReport || inFlight || snapshot.phase !== 'idle') return;
  const initial = snapshot;
  const receipts = await loadDebugLogUploadReceipts();
  const receipt = receipts.find(item => item.contentSha256 === request.publicReport!.contentSha256);
  const attempt = receipt ? null : await publicReportUploadAttempt(request.publicReport.contentSha256);
  const uncertain = attempt === 'pending';
  if (snapshot !== initial || inFlight) return;
  if (!receipt && !attempt) return;
  lastRequest = request;
  lastAuditSession = request.sessionId;
  preparedBody = request.publicReport.body;
  pendingReceipt = receipt ?? null;
  update({ sessionId: request.sessionId, phase: 'failed', url: receipt?.url ?? null,
    preparationFailed: false,
    verified: receipt?.verified === true, mayHaveUploaded: uncertain,
    error: receipt?.verified ? null : receipt ? 'The saved upload needs verification before it can be shared.'
      : 'The completed report has not been confirmed as uploaded. Retry upload is available.' });
}

export function forgetDeletedDebugLogUpload(url: string): void {
  if (snapshot.url !== url) return;
  pendingReceipt = null;
  preparedBody = null;
  if (blockedRequest) {
    lastRequest = blockedRequest;
    lastAuditSession = blockedRequest.sessionId;
    blockedRequest = null;
    update({
      phase: 'failed', sessionId: lastRequest.sessionId, url: null, verified: false,
      error: 'The earlier upload was removed. Retry upload to share the completed audit.',
      recoveryReceipt: null, mayHaveUploaded: false,
    });
    return;
  }
  lastAuditSession = null;
  update({ phase: 'idle', url: null, verified: false, error: null, recoveryReceipt: null });
}
