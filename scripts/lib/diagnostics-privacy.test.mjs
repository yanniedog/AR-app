#!/usr/bin/env node
import assert from 'node:assert/strict';

import {
  extractDeidentifiedEventLogs,
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

console.log('diagnostics-privacy.test.mjs: ok');
