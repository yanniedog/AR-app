#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const staticConfig = require('../app.json');

function configFor(channel, release) {
  const previous = {
    channel: process.env.AR_APP_DISTRIBUTION_CHANNEL,
    version: process.env.AR_APP_RELEASE_VERSION,
    versionCode: process.env.AR_APP_ANDROID_VERSION_CODE,
  };
  process.env.AR_APP_DISTRIBUTION_CHANNEL = channel;
  if (release) {
    process.env.AR_APP_RELEASE_VERSION = release.version;
    process.env.AR_APP_ANDROID_VERSION_CODE = String(release.versionCode);
  } else {
    delete process.env.AR_APP_RELEASE_VERSION;
    delete process.env.AR_APP_ANDROID_VERSION_CODE;
  }
  delete require.cache[require.resolve('../app.config.js')];
  try {
    return require('../app.config.js')({ config: staticConfig.expo });
  } finally {
    if (previous.channel == null) delete process.env.AR_APP_DISTRIBUTION_CHANNEL;
    else process.env.AR_APP_DISTRIBUTION_CHANNEL = previous.channel;
    if (previous.version == null) delete process.env.AR_APP_RELEASE_VERSION;
    else process.env.AR_APP_RELEASE_VERSION = previous.version;
    if (previous.versionCode == null) delete process.env.AR_APP_ANDROID_VERSION_CODE;
    else process.env.AR_APP_ANDROID_VERSION_CODE = previous.versionCode;
  }
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

test('release environment overrides version metadata without rewriting app.json', () => {
  const originalVersion = staticConfig.expo.version;
  const originalVersionCode = staticConfig.expo.android.versionCode;
  const config = configFor('play', { version: '1.2.345', versionCode: 987 });
  assert.equal(config.version, '1.2.345');
  assert.equal(config.android.versionCode, 987);
  assert.equal(staticConfig.expo.version, originalVersion);
  assert.equal(staticConfig.expo.android.versionCode, originalVersionCode);
});

test('rejects partial or malformed release overrides', () => {
  const previousCode = process.env.AR_APP_ANDROID_VERSION_CODE;
  process.env.AR_APP_ANDROID_VERSION_CODE = '123';
  delete process.env.AR_APP_RELEASE_VERSION;
  delete require.cache[require.resolve('../app.config.js')];
  try {
    assert.throws(
      () => require('../app.config.js')({ config: staticConfig.expo }),
      /must be provided together/i,
    );
  } finally {
    if (previousCode == null) delete process.env.AR_APP_ANDROID_VERSION_CODE;
    else process.env.AR_APP_ANDROID_VERSION_CODE = previousCode;
  }
});
