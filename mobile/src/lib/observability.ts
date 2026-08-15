import { Platform } from 'react-native';

import type { LogLevel } from './debugLog';
import {
  buildDeidentifiedPerformanceAudit,
  performanceAuditFingerprint,
} from './diagnosticsEnvelope';
import type { PerformanceAuditReport } from './performanceAudit';

let crashReportsEnabled = false;
let sessionReplayEnabled = false;
let clarityInitialized = false;

export type CrashlyticsLike = {
  log: (message: string) => void;
  recordError: (error: Error, name?: string) => void;
  setCrashlyticsCollectionEnabled: (enabled: boolean) => Promise<void> | void;
};

export type ClarityLike = {
  initialize: (projectId: string) => void;
  pause: () => Promise<boolean>;
  resume: () => Promise<boolean>;
  consent: (adsStorage: boolean, analyticsStorage: boolean) => Promise<boolean>;
};

type ObservabilityDeps = {
  crashlytics: () => CrashlyticsLike;
  clarity: ClarityLike;
};

let deps: ObservabilityDeps | null = null;

function loadNativeDeps(): ObservabilityDeps | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native bridge
    const crashlytics = require('@react-native-firebase/crashlytics').default as () => CrashlyticsLike;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native bridge
    const clarity = require('@microsoft/react-native-clarity') as ClarityLike;
    return { crashlytics, clarity };
  } catch {
    return null;
  }
}

function getDeps(): ObservabilityDeps | null {
  if (deps) return deps;
  deps = loadNativeDeps();
  return deps;
}

function clarityProjectId(): string | undefined {
  return process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID?.trim() || undefined;
}

function tryInitializeClarity(native: ObservabilityDeps): void {
  const projectId = clarityProjectId();
  if (!projectId || __DEV__ || clarityInitialized) return;
  try {
    native.clarity.initialize(projectId);
    clarityInitialized = true;
  } catch {
    // native module unavailable
  }
}

/** Test hook — inject mocks or reset to lazy native load. */
export function setObservabilityDepsForTests(next: ObservabilityDeps | null): void {
  deps = next;
  if (!next) {
    clarityInitialized = false;
    crashReportsEnabled = false;
    sessionReplayEnabled = false;
  }
}

export function isDiagnosticsEnabled(): boolean {
  return crashReportsEnabled;
}

const ALLOWED_REPLAY_ROUTES = [
  '/trends',
  '/banks',
  '/bank',
  '/terms',
];

export function isSessionReplayRouteAllowed(pathname: string): boolean {
  const normalized = `/${pathname}`.replace(/\/+/g, '/').toLowerCase();
  return ALLOWED_REPLAY_ROUTES.some(
    (route) => normalized === route || normalized.startsWith(`${route}/`),
  );
}

/** @deprecated Compatibility wrapper for callers/tests predating split consent. */
export async function setDiagnosticsEnabled(enabled: boolean): Promise<void> {
  await Promise.all([setCrashReportsEnabled(enabled), setSessionReplayEnabled(enabled)]);
}

export async function setCrashReportsEnabled(enabled: boolean): Promise<void> {
  crashReportsEnabled = enabled;
  const native = getDeps();
  if (!native) return;
  try {
    await native.crashlytics().setCrashlyticsCollectionEnabled(enabled);
  } catch {
    // Expo Go / tests without native modules
  }
}

export async function setSessionReplayEnabled(enabled: boolean): Promise<void> {
  sessionReplayEnabled = enabled;
  const native = getDeps();
  if (!native) return;
  try {
    const wasInitialized = clarityInitialized;
    if (enabled && !wasInitialized) tryInitializeClarity(native);
    if (clarityInitialized) {
      await native.clarity.consent(false, enabled);
      if (enabled) await native.clarity.resume();
      else await native.clarity.pause();
    }
  } catch {
    // Expo Go / tests without native modules
  }
}

/** Initialize Clarity (preview/production) and Crashlytics collection. */
export async function initObservability(): Promise<void> {
  const native = getDeps();
  if (!native) return;

  try {
    await native.crashlytics().setCrashlyticsCollectionEnabled(crashReportsEnabled);
  } catch {
    // non-fatal
  }

  if (sessionReplayEnabled) tryInitializeClarity(native);
  if (clarityInitialized) {
    await native.clarity.consent(false, sessionReplayEnabled).catch(() => false);
  }
}

function logStructuredDiagnostic(native: ObservabilityDeps, payload: unknown): void {
  const encoded = JSON.stringify(payload);
  const chunkSize = 900;
  const chunks = Math.min(32, Math.ceil(encoded.length / chunkSize));
  for (let index = 0; index < chunks; index += 1) {
    native.crashlytics().log(
      `[auto-diagnostic ${index + 1}/${chunks}] ${encoded.slice(index * chunkSize, (index + 1) * chunkSize)}`,
    );
  }
}

function redactCrashlyticsMessage(message: string): string {
  return message
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, '[REDACTED_IP]')
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
      '[REDACTED_UUID]',
    )
    .replace(/https?:\/\/[^\s)]+/gi, (url) => {
      try {
        const parsed = new URL(url);
        return `${parsed.origin}${parsed.pathname}`;
      } catch {
        return '[REDACTED_URL]';
      }
    })
    .replace(/\/(?:data|storage|sdcard)\/[^\s"']+/gi, '[REDACTED_PATH]');
}

/** Submit a bounded, allowlisted audit through Crashlytics for private GitHub triage. */
export function reportPerformanceAudit(report: PerformanceAuditReport): boolean {
  if (!crashReportsEnabled) return false;
  const native = getDeps();
  if (!native) return false;
  try {
    logStructuredDiagnostic(native, buildDeidentifiedPerformanceAudit(report));
    native.crashlytics().recordError(
      new Error(`performance-audit:${performanceAuditFingerprint(report)}`),
      'AutomaticPerformanceAudit',
    );
    return true;
  } catch {
    return false;
  }
}

/** Forward debugLog lines to Crashlytics when diagnostics are enabled. */
export function bridgeLogToCrashlytics(level: LogLevel, tag: string, message: string): void {
  if (!crashReportsEnabled || level === 'debug') return;
  const native = getDeps();
  if (!native) return;

  const line = redactCrashlyticsMessage(`[${level.toUpperCase()}] ${tag}: ${message}`);
  try {
    native.crashlytics().log(line);
    if (level === 'error') {
      native.crashlytics().recordError(new Error(line), tag);
    }
  } catch {
    // non-fatal
  }
}
