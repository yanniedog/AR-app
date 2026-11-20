import * as Clipboard from 'expo-clipboard';
import { auditEntryClock } from './auditEntryTrace';
import { publicDebugLogUploadText } from './publicDebugLogUploadText';
import { loadDebugLogUploadRecoveryReceipt, saveDebugLogUploadRecoveryReceipt, removeDebugLogUploadRecoveryReceipt } from './debugLogUploadRecovery';
import { loadPublicReportUploadAttempts, publicReportUploadUncertain, recordPublicReportUploadAttempt, publicReportUploadAttemptEpoch, publicReportUploadAttemptIsCurrent } from './publicReportUploadAttempt';

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
  /** Preferred link: the paste.rs pointer when present, otherwise the content host. */
  url: string | null;
  /** Content-host link (deletable). Equals `url` when no paste.rs pointer exists. */
  contentUrl?: string | null;
  /** paste.rs pointer to `contentUrl`, when the shortener succeeded. */
  shareUrl?: string | null;
  verified: boolean;
  error: string | null;
  /** Retain deletion access until the failed upload has been removed. */
  recoveryReceipt: DebugLogUploadReceipt | null;
  /** A lost POST response may have left an unknown public copy. */
  mayHaveUploaded: boolean;
  preparationFailed?: boolean;
}

/** Snapshot link fields for a receipt, so the UI can offer every known link. */
function linkPatch(receipt: DebugLogUploadReceipt): Pick<DebugLogUploadSnapshot, 'url' | 'contentUrl' | 'shareUrl'> {
  return { url: debugLogUploadShareUrl(receipt), contentUrl: receipt.url, shareUrl: receipt.shareUrl ?? null };
}
const NO_LINKS = { url: null, contentUrl: null, shareUrl: null } as const;

interface UploadRequest {
  sessionId: string | null;
  appVersion: string;
  buildVersion: string;
  audit?: { summaryMarker: string; report: unknown };
  /** Prepared by diagnosticsEnvelope's allowlist, never by a raw log export. */
  publicReport?: { body: string; contentSha256: string };
}

let snapshot: DebugLogUploadSnapshot = {
  sessionId: null, phase: 'idle', ...NO_LINKS, verified: false, error: null, recoveryReceipt: null,
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
  update({ sessionId, phase: 'failed', ...(snapshot.recoveryReceipt ? linkPatch(snapshot.recoveryReceipt) : NO_LINKS), verified: false, mayHaveUploaded: false,
    preparationFailed: true,
    error: 'The deidentified report could not be prepared. The completed report remains on this device.' });
}
function update(patch: Partial<DebugLogUploadSnapshot>): void {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((listener) => listener());
}

async function executeUpload(copyLink = false): Promise<DebugLogUploadSnapshot> {
  // Start before notifying subscribers so the sample includes UI contention
  // during an explicit copy of an already verified link.
  const copyStartedAt = copyLink && snapshot.verified && pendingReceipt && !snapshot.recoveryReceipt ? auditEntryClock() : null;
  const attemptEpoch = publicReportUploadAttemptEpoch();
  const flightEpoch = uploadFlightEpoch;
  const uploadRequest = lastRequest;
  const publish = (patch: Partial<DebugLogUploadSnapshot>) => {
    if (flightEpoch === uploadFlightEpoch) update(patch);
    else if (patch.recoveryReceipt) update({ sessionId: null, phase: 'failed', ...linkPatch(patch.recoveryReceipt),
      recoveryReceipt: patch.recoveryReceipt, verified: false, error: 'Delete the uploaded log using its recovery receipt in Debug log.' });
  };
  try {
    if (!pendingReceipt) {
      publish({ phase: 'preparing', error: null });
      // Read before creating a public copy, so a storage failure cannot orphan it.
      const recovery = await loadDebugLogUploadRecoveryReceipt();
      if (recovery) {
        pendingReceipt = recovery;
        publish({ ...linkPatch(recovery), recoveryReceipt: recovery });
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
        publish({ ...linkPatch(pendingReceipt), verified: pendingReceipt.verified === true });
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
        // Callback-assigned; keep a typed local so the else-narrowed pendingReceipt
        // (null at branch entry) does not erase the early hosted createdAt.
        let hostedCreatedAt: string | undefined;
        try {
          result = await uploadDebugLog(preparedBody, fetch, {
            onContentHosted: async (partial) => {
              // Best-effort early persist; final save below still owns failure recovery.
              try {
                const early = hash
                  ? await saveDebugLogUploadReceipt(partial, undefined, hash)
                  : await saveDebugLogUploadReceipt(partial);
                pendingReceipt = early;
                hostedCreatedAt = early.createdAt;
                publish(linkPatch(early));
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
          createdAt: hostedCreatedAt ?? new Date().toISOString(),
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
            publish({ ...linkPatch(receipt), recoveryReceipt: receipt });
            throw new Error(recoverySaved
              ? 'The upload needs deletion. Its recovery deletion receipt is saved securely; use Delete uploaded log in Debug log.'
              : 'Secure deletion recovery is unavailable. Keep this app open and use Delete uploaded log in Debug log before restarting.');
          }
          throw new Error('The new paste was removed because its deletion receipt could not be saved. The full log is still available locally.');
        }
        if (hash) await recordPublicReportUploadAttempt(hash, null, attemptEpoch);
        publish(linkPatch(pendingReceipt));
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
      if (flightEpoch !== uploadFlightEpoch) return snapshot;
      if (uploadRequest?.publicReport) {
        try {
          await debugLog.startFreshAfterAuditUpload(uploadRequest.publicReport.contentSha256,
            () => flightEpoch === uploadFlightEpoch);
        } catch {
          throw new Error('The audit uploaded, but the previous log could not be cleared. Retry to finish sharing.');
        }
      }
      if (flightEpoch !== uploadFlightEpoch) return snapshot;
      pendingReceipt = await markDebugLogUploadReceiptVerified(pendingReceipt);
      publish({ verified: true });
    }
    if (flightEpoch !== uploadFlightEpoch) { preparedBody = null; pendingReceipt = null; return snapshot; }
    if (!copyLink && uploadRequest?.publicReport) {
      publish({ phase: 'verified', error: null });
      preparedBody = null;
      return snapshot;
    }
    // Dispatch the native clipboard write before waking subscribers.
    const copy = Clipboard.setStringAsync(debugLogUploadShareUrl(pendingReceipt));
    publish({ phase: 'copying', error: null });
    const copied = await copy;
    if (copied === false) throw new Error('Clipboard write was refused.');
    publish({ phase: 'copied' });
    if (copyStartedAt != null) debugLog.info('diagnostics-clipboard', `Verified link copy completed in ${Math.round(auditEntryClock() - copyStartedAt)} ms`);
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
    if (copyStartedAt != null) debugLog.info('diagnostics-clipboard', `Verified link copy failed in ${Math.round(auditEntryClock() - copyStartedAt)} ms`);
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
  update({ sessionId: request.sessionId, phase: 'preparing', ...NO_LINKS, verified: false, error: null, mayHaveUploaded: false,
    preparationFailed: false });
  return run();
}

/** Reuse known links; an ambiguous POST requires explicit duplicate-risk acknowledgement. */
export function retryDebugLogUpload(options: { acceptDuplicateRisk?: boolean } = {}): Promise<DebugLogUploadSnapshot> {
  if (inFlight) return inFlight;
  if (!lastRequest) return Promise.resolve(snapshot);
  if (snapshot.mayHaveUploaded && !options.acceptDuplicateRisk) return Promise.resolve(snapshot);
  duplicateRiskAccepted = options.acceptDuplicateRisk === true;
  if (snapshot.mayHaveUploaded) update({ mayHaveUploaded: false });
  return run(true);
}

/**
 * Copy one specific link of a verified upload: the paste.rs pointer ('share')
 * or the paste.c-net.org content host ('content'). Never uploads or verifies.
 */
export function copyDebugLogUploadLink(which: 'share' | 'content'): Promise<DebugLogUploadSnapshot> {
  if (inFlight) return inFlight;
  const url = which === 'share' ? snapshot.shareUrl : snapshot.contentUrl ?? snapshot.url;
  if (!url || !snapshot.verified || snapshot.recoveryReceipt) return Promise.resolve(snapshot);
  const flightEpoch = uploadFlightEpoch;
  inFlight = (async () => {
    try {
      const copy = Clipboard.setStringAsync(url);
      update({ phase: 'copying', error: null });
      if (await copy === false) throw new Error('Clipboard write was refused.');
      if (flightEpoch === uploadFlightEpoch) update({ phase: 'copied' });
    } catch {
      if (flightEpoch === uploadFlightEpoch) {
        update({ phase: 'failed', error: 'The link could not be copied. Tap a copy button to try again.' });
        debugLog.warn('debugLogUpload', 'Link copy failed');
      }
    }
    return snapshot;
  })().finally(() => { inFlight = null; });
  return inFlight;
}

/** Restore known report status without network or clipboard writes. */
export async function restorePublicReportUpload(sessionId: string, prepare: () => UploadRequest, shouldRestore: () => boolean): Promise<void> {
  if (inFlight || snapshot.phase !== 'idle' || !shouldRestore()) return;
  const initial = snapshot;
  const isCurrent = () => snapshot === initial && !inFlight && shouldRestore();
  const recovery = await loadDebugLogUploadRecoveryReceipt();
  if (!isCurrent()) return;
  if (recovery) {
    update({ sessionId, phase: 'failed', ...linkPatch(recovery), recoveryReceipt: recovery,
      error: 'Delete the upload using the securely saved recovery receipt in Debug log.' });
    return;
  }
  const receipts = (await loadDebugLogUploadReceipts()).filter(item => item.contentSha256);
  const attempts = receipts.length === 0 ? await loadPublicReportUploadAttempts() : null;
  if (!isCurrent()) return;
  // Preparing a report performs synchronous redaction, compression and hashing.
  // Fresh/local results and ordinary raw-log receipts have nothing to match.
  if (attempts && Object.keys(attempts).length === 0) return;
  const request = prepare();
  if (!request.publicReport) return;
  const { contentSha256 } = request.publicReport;
  const receipt = receipts.find(item => item.contentSha256 === contentSha256);
  const attempt = receipt ? null : (attempts ?? await loadPublicReportUploadAttempts())[contentSha256];
  const uncertain = attempt === 'pending';
  if (!isCurrent() || (!receipt && !attempt)) return;
  lastRequest = request;
  lastAuditSession = request.sessionId;
  preparedBody = request.publicReport.body;
  pendingReceipt = receipt ?? null;
  update({ sessionId: request.sessionId, phase: 'failed', ...(receipt ? linkPatch(receipt) : NO_LINKS),
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
      phase: 'failed', sessionId: lastRequest.sessionId, ...NO_LINKS, verified: false,
      error: 'The earlier upload was removed. Retry upload to share the completed audit.',
      recoveryReceipt: null, mayHaveUploaded: false,
    });
    return;
  }
  lastAuditSession = null;
  update({ phase: 'idle', ...NO_LINKS, verified: false, error: null, recoveryReceipt: null });
}

/** Clear private retry bodies and stale completion callbacks without deleting public-copy capabilities. */
export function resetClearedPublicReportUpload(): void {
  uploadFlightEpoch += 1;
  lastRequest = null; lastAuditSession = null; blockedRequest = null; queuedAuditRequest = null;
  preparedBody = null; pendingReceipt = null; duplicateRiskAccepted = false;
  const recovery = snapshot.recoveryReceipt;
  update({ sessionId: null, phase: recovery ? 'failed' : 'idle', ...(recovery ? linkPatch(recovery) : NO_LINKS), verified: false,
    error: recovery ? 'Delete the uploaded log using its recovery receipt in Debug log.' : null,
    mayHaveUploaded: false, preparationFailed: false });
}
