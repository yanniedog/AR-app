export const CRASHLYTICS_ERROR_CATEGORIES: Readonly<Record<string, string>> = {
  app: 'app-lifecycle',
  global: 'unhandled-runtime',
  'app-update': 'app-update',
  payload: 'payload',
  store: 'data-store',
  'tracked-rates': 'tracked-rates',
  history: 'history',
  'bank-insights': 'bank-insights',
};

export const PRIVACY_RUNTIME_POLICY = Object.freeze({
  crashReportsRequireConsent: true,
  crashReportsUseFixedCategoriesOnly: true,
  appHealthAutomaticUpload: false,
  debugLogAutomaticUpload: false,
  sessionReplayCollected: false,
  diagnosticsProcessor: 'Google Firebase Crashlytics',
  privateMaintainerTriageMayBeEnabled: true,
});

export const OPTIONAL_DIAGNOSTICS_TERMS =
  'Only after you opt in, Google Firebase Crashlytics can receive crash traces, device and app-build details, and fixed technical error categories. If private maintainer triage is enabled, an automatically redacted sample trace may also be copied to a private GitHub issue tracker that only maintainers can access and may be retained until that issue is closed or deleted. Automated redaction reduces, but cannot eliminate, the chance that a trace contains identifying details. Raw logs, searches, saved rates, profile and calculator inputs, routes, app-health results, and the Debug log remain on this device unless you explicitly share or upload a deidentified report. Session replay is not collected. You can disable crash reports in Settings at any time.';
