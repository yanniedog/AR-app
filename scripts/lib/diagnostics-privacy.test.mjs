#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CRASHLYTICS_PRIVACY_NOTICE_KEY,
  DIAGNOSTICS_PRIVACY_NOTICE_VERSION,
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
