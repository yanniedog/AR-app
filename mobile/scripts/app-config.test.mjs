#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const staticConfig = require('../app.json');

function configFor(channel) {
  const previous = process.env.AR_APP_DISTRIBUTION_CHANNEL;
  process.env.AR_APP_DISTRIBUTION_CHANNEL = channel;
  delete require.cache[require.resolve('../app.config.js')];
  const result = require('../app.config.js')({ config: staticConfig.expo });
  if (previous == null) delete process.env.AR_APP_DISTRIBUTION_CHANNEL;
  else process.env.AR_APP_DISTRIBUTION_CHANNEL = previous;
  return result;
}

test('sideload builds keep the verified installer permission and updater', () => {
  const config = configFor('sideload');
  assert.ok(config.android.permissions.includes('REQUEST_INSTALL_PACKAGES'));
  assert.equal(config.extra.selfUpdateEnabled, true);
});

test('Google Play builds remove the installer permission and updater', () => {
  const config = configFor('play');
  assert.ok(!config.android.permissions.includes('REQUEST_INSTALL_PACKAGES'));
  assert.equal(config.extra.selfUpdateEnabled, false);
});
