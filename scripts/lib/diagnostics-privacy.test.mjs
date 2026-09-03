#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CRASHLYTICS_PRIVACY_NOTICE_KEY,
  DIAGNOSTICS_PRIVACY_NOTICE_VERSION,
  deriveAttestedDiagnosticsIssue,
  extractDeidentifiedEventLogs,
  hasCurrentDiagnosticsConsentAttestation,
  redactDiagnosticText,
} from './diagnostics-privacy.mjs';

const scrubbed = redactDiagnosticText(
  'person@example.com 203.0.113.7 0f8fad5b-d9cb-469f-a165-70867728950e https://example.test/path?q=secret#x',
);
assert.doesNotMatch(scrubbed, /person@example|203\.0\.113|0f8fad|q=secret/);
assert.match(scrubbed, /https:\/\/example\.test\/path/);

const logs = extractDeidentifiedEventLogs({
  installationUuid: 'private-install-id',
  user: { id: 'private-user' },
  logs: [
    { timestamp: 'private-time', message: 'ordinary log' },
    { message: '[auto-diagnostic 1/1] {"checks":24}' },
  ],
});
assert.equal(logs, '[auto-diagnostic 1/1] {"checks":24}');
assert.doesNotMatch(logs, /private/);

assert.equal(hasCurrentDiagnosticsConsentAttestation({
  customKeys: {
    [CRASHLYTICS_PRIVACY_NOTICE_KEY]: DIAGNOSTICS_PRIVACY_NOTICE_VERSION,
  },
}), true);
assert.equal(hasCurrentDiagnosticsConsentAttestation({ customKeys: {} }), false);
assert.equal(hasCurrentDiagnosticsConsentAttestation({
  customKeys: { [CRASHLYTICS_PRIVACY_NOTICE_KEY]: 'older-notice' },
}), false);
assert.equal(hasCurrentDiagnosticsConsentAttestation({
  logs: [{ message: `${CRASHLYTICS_PRIVACY_NOTICE_KEY}=${DIAGNOSTICS_PRIVACY_NOTICE_VERSION}` }],
}), false, 'a log message cannot forge the dedicated custom-key attestation');

const evidence = deriveAttestedDiagnosticsIssue('mixed-issue', [
  {
    issue: {
      id: 'mixed-issue',
      title: 'Older private title',
      subtitle: 'Older private subtitle',
      errorType: 'FATAL',
      state: 'OPEN',
      signals: [{ signal: 'SIGNAL_REPETITIVE', description: 'older aggregate' }],
    },
    issueTitle: 'Older private title',
    issueSubtitle: 'Older private subtitle',
    eventTime: '2026-08-01T00:00:00Z',
    version: { displayVersion: '1.0.1' },
    customKeys: { [CRASHLYTICS_PRIVACY_NOTICE_KEY]: 'older-notice' },
  },
  {
    issue: {
      id: 'mixed-issue',
      title: 'Attested title',
      subtitle: 'Attested subtitle',
      errorType: 'NON_FATAL',
      state: 'OPEN',
      uri: 'https://console.firebase.google.com/attested',
      signals: [{ signal: 'SIGNAL_REPETITIVE', description: 'mixed aggregate' }],
    },
    issueTitle: 'Attested title',
    issueSubtitle: 'Attested subtitle',
    eventTime: '2026-09-02T00:00:00Z',
    version: { displayVersion: '1.0.179' },
    customKeys: { [CRASHLYTICS_PRIVACY_NOTICE_KEY]: DIAGNOSTICS_PRIVACY_NOTICE_VERSION },
  },
  {
    issue: {
      id: 'mixed-issue',
      title: 'Latest attested title',
      subtitle: 'Latest attested subtitle',
      errorType: 'NON_FATAL',
      state: 'OPEN',
    },
    issueTitle: 'Latest attested title',
    issueSubtitle: 'Latest attested subtitle',
    eventTime: '2026-09-03T00:00:00Z',
    version: { displayVersion: '1.0.180' },
    customKeys: { [CRASHLYTICS_PRIVACY_NOTICE_KEY]: DIAGNOSTICS_PRIVACY_NOTICE_VERSION },
  },
]);
assert.equal(evidence.metrics.eventsCount, '2');
assert.equal(evidence.issue.title, 'Latest attested title');
assert.equal(evidence.issue.firstSeenVersion, '1.0.179');
assert.equal(evidence.issue.lastSeenVersion, '1.0.180');
assert.equal(evidence.issue.firstSeenTime, '2026-09-02T00:00:00Z');
assert.equal(evidence.issue.lastSeenTime, '2026-09-03T00:00:00Z');
assert.deepEqual(evidence.issue.signals, []);
assert.doesNotMatch(JSON.stringify(evidence), /Older private|older aggregate|mixed aggregate/);

const mobilePolicy = readFileSync(
  new URL('../../mobile/src/lib/privacyPolicy.ts', import.meta.url),
  'utf8',
);
const workflow = readFileSync(
  new URL('../../.github/workflows/crashlytics-github-issues.yml', import.meta.url),
  'utf8',
);
assert.match(
  mobilePolicy,
  new RegExp(`DIAGNOSTICS_PRIVACY_NOTICE_VERSION = '${DIAGNOSTICS_PRIVACY_NOTICE_VERSION}'`),
);
assert.match(
  mobilePolicy,
  new RegExp(`CRASHLYTICS_PRIVACY_NOTICE_KEY = '${CRASHLYTICS_PRIVACY_NOTICE_KEY}'`),
);
assert.match(
  workflow,
  new RegExp(`DIAGNOSTICS_PRIVACY_NOTICE_VERSION:-}" != "${DIAGNOSTICS_PRIVACY_NOTICE_VERSION}"`),
);

console.log('diagnostics-privacy.test.mjs: ok');
