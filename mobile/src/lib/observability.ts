import { Platform } from 'react-native';

import type { LogLevel } from './debugLog';

let crashReportsEnabled = false;

export type CrashlyticsLike = {
  log: (message: string) => void;
  recordError: (error: Error, name?: string) => void;
  setCrashlyticsCollectionEnabled: (enabled: boolean) => Promise<void> | void;
};

type ObservabilityDeps = {
  crashlytics: () => CrashlyticsLike;
};

let deps: ObservabilityDeps | null = null;

function loadNativeDeps(): ObservabilityDeps | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy native bridge
    const crashlytics = require('@react-native-firebase/crashlytics').default as () => CrashlyticsLike;
    return { crashlytics };
  } catch {
    return null;
  }
}

function getDeps(): ObservabilityDeps | null {
  if (deps) return deps;
  deps = loadNativeDeps();
  return deps;
}

/** Test hook — inject mocks or reset to lazy native load. */
export function setObservabilityDepsForTests(next: ObservabilityDeps | null): void {
  deps = next;
  if (!next) {
    crashReportsEnabled = false;
  }
}

export function isDiagnosticsEnabled(): boolean {
  return crashReportsEnabled;
}

/** @deprecated Compatibility wrapper for callers/tests predating split consent. */
export async function setDiagnosticsEnabled(enabled: boolean): Promise<void> {
  await setCrashReportsEnabled(enabled);
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

export function setSessionReplayEnabled(_enabled: boolean): Promise<void> {
  // Financial and diagnostic screens cannot be protected by a best-effort
  // asynchronous route pause. Keep replay fail-closed until independently
  // masked native capture is available.
  // The SDK is deliberately not initialized, so no asynchronous route
  // transition can expose a sensitive screen before capture pauses.
  return Promise.resolve();
}

/** Initialize the consent-gated Crashlytics collection state. */
export async function initObservability(): Promise<void> {
  const native = getDeps();
  if (!native) return;

  try {
    await native.crashlytics().setCrashlyticsCollectionEnabled(crashReportsEnabled);
  } catch {
    // non-fatal
  }
}

const CRASHLYTICS_ERROR_CATEGORIES: Readonly<Record<string, string>> = {
  app: 'app-lifecycle',
  global: 'unhandled-runtime',
  'app-update': 'app-update',
  payload: 'payload',
  store: 'data-store',
  'tracked-rates': 'tracked-rates',
  history: 'history',
  'bank-insights': 'bank-insights',
};

/**
 * Forward only a fixed error category. Raw messages remain in the local debug
 * log: regex redaction cannot make arbitrary product, receipt, route or device
 * text safe for automatic telemetry.
 */
export function bridgeLogToCrashlytics(level: LogLevel, tag: string, _message: string): void {
  if (!crashReportsEnabled || level !== 'error') return;
  const native = getDeps();
  if (!native) return;

  const category = CRASHLYTICS_ERROR_CATEGORIES[tag] ?? 'component';
  const line = `[ERROR] category=${category}`;
  try {
    native.crashlytics().log(line);
    native.crashlytics().recordError(new Error(line), `AppError:${category}`);
  } catch {
    // non-fatal
  }
}
