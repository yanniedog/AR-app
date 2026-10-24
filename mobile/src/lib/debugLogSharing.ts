import * as Clipboard from 'expo-clipboard';
import { publicDebugLogUploadText } from './publicDebugLogUploadText';
import { loadDebugLogUploadRecoveryReceipt, saveDebugLogUploadRecoveryReceipt, removeDebugLogUploadRecoveryReceipt } from './debugLogUploadRecovery';
import { publicReportUploadAttempt, publicReportUploadUncertain, recordPublicReportUploadAttempt, publicReportUploadAttemptEpoch, publicReportUploadAttemptIsCurrent } from './publicReportUploadAttempt';

import {
  debugLog,
  debugLogUploadShareUrl,
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
  phase: 'idle' | 'preparing' | 'uploading' | 'verifying' | 'verified' | 'copying' | 'copied' | 'failed';
  url: string | null;
  verified: boolean;
  error: string | null;
  /** Retain deletion access until the failed upload has been removed. */
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
let uploadFlightEpoch = 0;

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

async function executeUpload(copyLink = false): Promise<DebugLogUploadSnapshot> {
  const attemptEpoch = publicReportUploadAttemptEpoch();
  const flightEpoch = uploadFlightEpoch;
  const uploadRequest = lastRequest;
  const publish = (patch: Partial<DebugLogUploadSnapshot>) => {
    if (flightEpoch === uploadFlightEpoch) update(patch);
    else if (patch.recoveryReceipt) update({ sessionId: null, phase: 'failed', url: patch.recoveryReceipt.url,
      recoveryReceipt: patch.recoveryReceipt, verified: false, error: 'Delete the uploaded log using its recovery receipt in Debug log.' });
  };
  try {
    if (!pendingReceipt) {
      publish({ phase: 'preparing', error: null });
      // Read before creating a public copy, so a storage failure cannot orphan it.
      const recovery = await loadDebugLogUploadRecoveryReceipt();
      if (recovery) {
        pendingReceipt = recovery;
        publish({ url: debugLogUploadShareUrl(recovery), recoveryReceipt: recovery });
        throw new Error('Delete the earlier upload from Debug log before creating another public copy.');
      }
      const receipts = await loadDebugLogUploadReceipts();
      if (flightEpoch !== uploadFlightEpoch) return snapshot;
      if (!uploadRequest) return snapshot;
      const request = uploadRequest;
      preparedBody = request.publicReport?.body ?? formatVersionedLogExport(
        publicDebugLogUploadText(await debugLog.readCompleteText(request.audit)), request.appVersion, request.buildVersion,
      );
      if (flightEpoch !== uploadFlightEpoch) { preparedBody = null; return snapshot; }
      const hash = request.publicReport?.contentSha256;
      pendingReceipt = hash ? receipts.find(receipt => receipt.contentSha256 === hash) ?? null : null;
      if (pendingReceipt) {
        publish({ url: debugLogUploadShareUrl(pendingReceipt), verified: pendingReceipt.verified === true });
      } else {
        if (hash) {
          if (!duplicateRiskAccepted && await publicReportUploadUncertain(hash)) {
            throw Object.assign(new Error('The earlier upload result was not confirmed.'), { mayHaveUploaded: true });
          }
          // Durably record intent BEFORE POST; a restart must not create another copy.
          await recordPublicReportUploadAttempt(hash, 'pending', attemptEpoch);
          if (!publicReportUploadAttemptIsCurrent(attemptEpoch)) throw new Error('The diagnostic upload was cleared before publication.');
        }
        if (flightEpoch !== uploadFlightEpoch) { preparedBody = null; return snapshot; }
        publish({ phase: 'uploading' });
        let result: Awaited<ReturnType<typeof uploadDebugLog>>;
        try {
          result = await uploadDebugLog(preparedBody, fetch, {
            onContentHosted: async (partial) => {
              // Best-effort early persist; final save below still owns failure recovery.
              try {
                pendingReceipt = hash
                  ? await saveDebugLogUploadReceipt(partial, undefined, hash)
                  : await saveDebugLogUploadReceipt(partial);
                publish({ url: debugLogUploadShareUrl(pendingReceipt) });
              } catch { /* SecureStore may be unavailable until the final save path. */ }
            },
          });
        } catch (error) {
          const uncertain = error instanceof Error && 'mayHaveUploaded' in error && error.mayHaveUploaded === true;
          if (hash && !uncertain) await recordPublicReportUploadAttempt(hash, 'failed', attemptEpoch);
          throw error;
        }
        const receipt: DebugLogUploadReceipt = {
          schemaVersion: 1, url: result.url, provider: result.provider,
          ...(result.deleteKey ? { deleteKey: result.deleteKey } : {}),
          ...(result.shareUrl ? { shareUrl: result.shareUrl } : {}),
          createdAt: pendingReceipt?.createdAt ?? new Date().toISOString(),
          ...(hash ? { contentSha256: hash } : {}),
        };
        try {
          // Refresh the receipt with shareUrl when the shortener succeeded.
          pendingReceipt = hash
            ? await saveDebugLogUploadReceipt(result, receipt.createdAt, hash)
            : await saveDebugLogUploadReceipt(result, receipt.createdAt);
        } catch {
          let recoverySaved = false;
          try { await saveDebugLogUploadRecoveryReceipt(receipt); recoverySaved = true; } catch { /* SecureStore may be unavailable. Never persist a plain fallback. */ }
          // Never delete older pastes to make room for a new one. Only clean up
          // this new copy if its deletion capability cannot be stored.
          try {
            await deleteDebugLogUpload(receipt.url, receipt.deleteKey);
            if (receipt.shareUrl) {
              try { await deleteDebugLogUpload(receipt.shareUrl); } catch { /* orphan shortener is non-blocking */ }
            }
            if (recoverySaved) await removeDebugLogUploadRecoveryReceipt(receipt.url);
            if (hash) await recordPublicReportUploadAttempt(hash, 'failed', attemptEpoch);
          } catch {
            pendingReceipt = receipt;
            publish({ url: debugLogUploadShareUrl(receipt), recoveryReceipt: receipt });
            throw new Error(recoverySaved
              ? 'The upload needs deletion. Its recovery deletion receipt is saved securely; use Delete uploaded log in Debug log.'
              : 'Secure deletion recovery is unavailable. Keep this app open and use Delete uploaded log in Debug log before restarting.');
          }
          throw new Error('The new paste was removed because its deletion receipt could not be saved. The full log is still available locally.');
        }
        if (hash) await recordPublicReportUploadAttempt(hash, null, attemptEpoch);
        publish({ url: debugLogUploadShareUrl(pendingReceipt) });
        if (result.truncated || result.clientTruncated) {
          throw new Error('The paste service did not accept the complete log.');
        }
      }
    }
    if (flightEpoch !== uploadFlightEpoch) { preparedBody = null; pendingReceipt = null; return snapshot; }
    if (snapshot.recoveryReceipt) {
      throw new Error('Delete the upload with the unsaved deletion receipt from Debug log before trying again.');
    }
    if (!snapshot.verified) {
      publish({ phase: 'verifying', error: null });
      await verifyDebugLogUpload(pendingReceipt, preparedBody!);
      pendingReceipt = await markDebugLogUploadReceiptVerified(pendingReceipt);
      publish({ verified: true });
    }
    if (flightEpoch !== uploadFlightEpoch) { preparedBody = null; pendingReceipt = null; return snapshot; }
    if (!copyLink && uploadRequest?.publicReport) {
      publish({ phase: 'verified', error: null });
      preparedBody = null;
      return snapshot;
    }
    publish({ phase: 'copying', error: null });
    const copied = await Clipboard.setStringAsync(debugLogUploadShareUrl(pendingReceipt));
    if (copied === false) throw new Error('Clipboard write was refused.');
    publish({ phase: 'copied' });
    preparedBody = null;
  } catch (error) {
    if (flightEpoch !== uploadFlightEpoch) { preparedBody = null; pendingReceipt = null; return snapshot; }
    const mayHaveUploaded = error instanceof Error &&
      'mayHaveUploaded' in error && error.mayHaveUploaded === true;
    publish({
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

function run(copyLink = false): Promise<DebugLogUploadSnapshot> {
  inFlight = executeUpload(copyLink).finally(() => { inFlight = null; });
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
  return run(true);
}

/** Restore known report status without network or clipboard writes. */
export async function restorePublicReportUpload(request: UploadRequest): Promise<void> {
  if (!request.publicReport || inFlight || snapshot.phase !== 'idle') return;
  const initial = snapshot;
  const recovery = await loadDebugLogUploadRecoveryReceipt();
  if (recovery) {
    if (snapshot === initial && !inFlight) update({ sessionId: request.sessionId, phase: 'failed', url: debugLogUploadShareUrl(recovery), recoveryReceipt: recovery,
      error: 'Delete the upload using the securely saved recovery receipt in Debug log.' });
    return;
  }
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
  update({ sessionId: request.sessionId, phase: 'failed', url: receipt ? debugLogUploadShareUrl(receipt) : null,
    preparationFailed: false,
    verified: receipt?.verified === true, mayHaveUploaded: uncertain,
    error: receipt?.verified ? null : receipt ? 'The saved upload needs verification before it can be shared.'
      : 'The completed report has not been confirmed as uploaded. Retry upload is available.' });
}

export function forgetDeletedDebugLogUpload(url: string): void {
  const matches =
    snapshot.url === url ||
    pendingReceipt?.url === url ||
    pendingReceipt?.shareUrl === url ||
    snapshot.recoveryReceipt?.url === url;
  if (!matches) return;
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

/** Clear private retry bodies and stale completion callbacks without deleting public-copy capabilities. */
export function resetClearedPublicReportUpload(): void {
  uploadFlightEpoch += 1;
  lastRequest = null; lastAuditSession = null; blockedRequest = null; queuedAuditRequest = null;
  preparedBody = null; pendingReceipt = null; duplicateRiskAccepted = false;
  const recovery = snapshot.recoveryReceipt;
  update({ sessionId: null, phase: recovery ? 'failed' : 'idle', url: recovery?.url ?? null, verified: false,
    error: recovery ? 'Delete the uploaded log using its recovery receipt in Debug log.' : null,
    mayHaveUploaded: false, preparationFailed: false });
}
