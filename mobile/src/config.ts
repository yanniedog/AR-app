import Constants from 'expo-constants';

type Extra = {
  payloadRepo?: string;
  payloadReleaseTag?: string;
  repo?: string;
  releaseTag?: string;
  manifestUrl?: string;
  datesIndexUrl?: string;
  apkRepo?: string;
  apkReleaseTag?: string;
  apkManifestUrl?: string;
  payloadDecKeyHex?: string;
  googleWebClientId?: string;
  keyServiceUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const PAYLOAD_REPO = extra.payloadRepo ?? extra.repo ?? 'yanniedog/AR-local';
export const RELEASE_TAG = extra.payloadReleaseTag ?? extra.releaseTag ?? 'app-payload-latest';
export const APK_REPO = extra.apkRepo ?? extra.repo ?? 'yanniedog/AR-app';
export const REPO = APK_REPO;

/** Immutable per-run_date snapshot tags: ``app-payload-YYYY-MM-DD``. */
export const DATED_TAG_PREFIX = 'app-payload-';

/**
 * URL of the rolling manifest the Pi publishes each day. The manifest in turn
 * points at the (date-stamped) core/details asset URLs, so the app only needs a
 * single stable URL baked in here.
 */
export const MANIFEST_URL =
  extra.manifestUrl ??
  `https://github.com/${PAYLOAD_REPO}/releases/download/${RELEASE_TAG}/manifest.json`;

/** Index of published history dates (refreshed after ingest / backfill). */
export const DATES_INDEX_URL =
  extra.datesIndexUrl ??
  MANIFEST_URL.replace(/\/manifest\.json$/i, '/dates-index.json');

/** Manifest URL for one immutable dated snapshot release. */
export function datedManifestUrl(runDate: string): string {
  return `https://github.com/${PAYLOAD_REPO}/releases/download/${DATED_TAG_PREFIX}${runDate}/manifest.json`;
}

export const APK_RELEASE_TAG = extra.apkReleaseTag ?? 'app-apk-latest';

/** Rolling APK manifest published after preview EAS builds (see mobile-eas-build.yml). */
export const APK_MANIFEST_URL =
  extra.apkManifestUrl ??
  `https://github.com/${APK_REPO}/releases/download/${APK_RELEASE_TAG}/app-apk-latest.json`;

/** Schema version this build understands. Older payloads still load best-effort. */
export const SUPPORTED_SCHEMA = 1;

/**
 * AES-256-GCM key (64 hex chars) for encrypted payload assets — Phase B of
 * docs/SECURITY_CDR_PIPELINE.md. Interim static key (obfuscation, not security);
 * Phase D replaces this with auth-gated key issuance. Empty = decryption
 * unavailable; the Pi must keep AR_LOCAL_PAYLOAD_ENC off until this is set in a
 * shipped build. Override via app.json extra.payloadDecKeyHex.
 */
export const PAYLOAD_DEC_KEY_HEX: string = extra.payloadDecKeyHex ?? '';

/**
 * Web client ID from the Firebase console (Authentication → Google provider)
 * enabling Google sign-in. Empty = the Account section shows sign-in as not
 * configured for this build.
 */
export const GOOGLE_WEB_CLIENT_ID: string = extra.googleWebClientId ?? '';

/**
 * issueContentKeys callable URL (Phase D key service, firebase/README.md).
 * Empty = keys come from SecureStore/bundled config only.
 */
export const KEY_SERVICE_URL: string = extra.keyServiceUrl ?? '';

/** Local-notification defaults. */
export const RATE_MOVE_BPS_THRESHOLD = 5; // notify when a category best rate moves >= 5bps

/**
 * Minimum deposit rate (fraction) treated as a real savings/TD interest offer.
 *
 * CDR payloads include many transaction, offset, and FX accounts at ~0.01% (1bp)
 * — token rates that are not savings products users want when hunting for the
 * best interest rate. 0.10% (10bp) drops that junk class while keeping low-but-
 * intentional savers (sample AR-local cores show genuine-ish floors from ~0.25%+).
 * Mortgages are never gated by this floor.
 */
export const MIN_MEANINGFUL_DEPOSIT_RATE_FRACTION = 0.001; // 0.10%
