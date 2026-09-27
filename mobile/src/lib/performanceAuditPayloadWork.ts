import type { AppState } from '../data/storeTypes';

const PAYLOAD_WORK_FLAGS = [
  'refreshing', 'postRefreshWarming', 'bankRateHistoryLoading', 'detailsLoading',
] as const;

type PayloadWorkState = Pick<AppState, typeof PAYLOAD_WORK_FLAGS[number] | 'core' | 'manifest'>;

/** Capture only bounded work/revision evidence, never payload rows or user preferences. */
export function captureAuditPayloadWork(state: PayloadWorkState, capturedAt = new Date().toISOString()) {
  const text = (value: unknown): string | null => typeof value === 'string' ? value.slice(0, 128) || null : null;
  const revision = state.manifest?.payload_revision;
  return {
    capturedAt,
    refreshing: state.refreshing === true,
    postRefreshWarming: state.postRefreshWarming === true,
    bankRateHistoryLoading: state.bankRateHistoryLoading === true,
    detailsLoading: state.detailsLoading === true,
    activeWork: PAYLOAD_WORK_FLAGS.filter(flag => state[flag] === true),
    revision: {
      runDate: text(state.core?.run_date),
      manifestRunDate: text(state.manifest?.run_date),
      coreSha: text(state.manifest?.files?.core?.sha256),
      detailsSha: text(state.manifest?.files?.details?.sha256),
      payloadRevision: Number.isSafeInteger(revision?.revision) ? revision!.revision : null,
      bundleSha: text(revision?.bundle_sha256),
    },
  };
}
