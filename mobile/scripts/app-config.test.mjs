#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const staticConfig = require('../app.json');

function configFor(channel, release, easRelease, iosInstallUrl) {
  const previous = {
    channel: process.env.AR_APP_DISTRIBUTION_CHANNEL,
    version: process.env.AR_APP_RELEASE_VERSION,
    versionCode: process.env.AR_APP_ANDROID_VERSION_CODE,
    easVersion: process.env.AR_APP_EAS_RELEASE_VERSION,
    easVersionCode: process.env.AR_APP_EAS_ANDROID_VERSION_CODE,
    iosInstallUrl: process.env.AR_APP_IOS_INSTALL_URL,
  };
  process.env.AR_APP_DISTRIBUTION_CHANNEL = channel;
  if (release) {
    process.env.AR_APP_RELEASE_VERSION = release.version;
    process.env.AR_APP_ANDROID_VERSION_CODE = String(release.versionCode);
  } else {
    delete process.env.AR_APP_RELEASE_VERSION;
    delete process.env.AR_APP_ANDROID_VERSION_CODE;
  }
  if (easRelease) {
    process.env.AR_APP_EAS_RELEASE_VERSION = easRelease.version;
    process.env.AR_APP_EAS_ANDROID_VERSION_CODE = String(easRelease.versionCode);
  } else {
    delete process.env.AR_APP_EAS_RELEASE_VERSION;
    delete process.env.AR_APP_EAS_ANDROID_VERSION_CODE;
  }
  if (iosInstallUrl) process.env.AR_APP_IOS_INSTALL_URL = iosInstallUrl;
  else delete process.env.AR_APP_IOS_INSTALL_URL;
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
    if (previous.easVersion == null) delete process.env.AR_APP_EAS_RELEASE_VERSION;
    else process.env.AR_APP_EAS_RELEASE_VERSION = previous.easVersion;
    if (previous.easVersionCode == null) delete process.env.AR_APP_EAS_ANDROID_VERSION_CODE;
    else process.env.AR_APP_EAS_ANDROID_VERSION_CODE = previous.easVersionCode;
    if (previous.iosInstallUrl == null) delete process.env.AR_APP_IOS_INSTALL_URL;
    else process.env.AR_APP_IOS_INSTALL_URL = previous.iosInstallUrl;
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

test('server-side EAS release environment reaches remote app config without source edits', () => {
  const config = configFor(
    'sideload',
    { version: '9.9.9', versionCode: 999 },
    { version: '1.2.346', versionCode: 988 },
  );
  assert.equal(config.version, '1.2.346');
  assert.equal(config.android.versionCode, 988);
});

test('an iOS install destination can be supplied by the release environment', () => {
  const url = 'https://apps.apple.com/au/app/example/id123';
  const config = configFor('play', null, null, url);
  assert.equal(config.extra.iosInstallUrl, url);
});

test('an iOS install destination is limited to Apple-controlled hosts', () => {
  assert.throws(
    () => configFor('play', null, null, 'https://example.test/fake-store'),
    /AR_APP_IOS_INSTALL_URL must be an https:\/\/apps\.apple\.com or https:\/\/testflight\.apple\.com URL/,
  );
});

test('rejects partial or malformed release overrides', () => {
  const previousCode = process.env.AR_APP_ANDROID_VERSION_CODE;
  const previousEasVersion = process.env.AR_APP_EAS_RELEASE_VERSION;
  const previousEasVersionCode = process.env.AR_APP_EAS_ANDROID_VERSION_CODE;
  process.env.AR_APP_ANDROID_VERSION_CODE = '123';
  delete process.env.AR_APP_RELEASE_VERSION;
  delete process.env.AR_APP_EAS_RELEASE_VERSION;
  delete process.env.AR_APP_EAS_ANDROID_VERSION_CODE;
  delete require.cache[require.resolve('../app.config.js')];
  try {
    assert.throws(
      () => require('../app.config.js')({ config: staticConfig.expo }),
      /must be provided together/i,
    );
  } finally {
    if (previousCode == null) delete process.env.AR_APP_ANDROID_VERSION_CODE;
    else process.env.AR_APP_ANDROID_VERSION_CODE = previousCode;
    if (previousEasVersion == null) delete process.env.AR_APP_EAS_RELEASE_VERSION;
    else process.env.AR_APP_EAS_RELEASE_VERSION = previousEasVersion;
    if (previousEasVersionCode == null) delete process.env.AR_APP_EAS_ANDROID_VERSION_CODE;
    else process.env.AR_APP_EAS_ANDROID_VERSION_CODE = previousEasVersionCode;
  }
});
