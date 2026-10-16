#!/usr/bin/env node
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const staticConfig = require('../app.json');

function configFor(channel, release, easRelease, iosInstallUrl, inputConfig = staticConfig.expo) {
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
    return require('../app.config.js')({ config: inputConfig });
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

test('build config rejects bundled payload key fields', () => {
  const configure = require('../app.config.js');
  assert.throws(() => configure({ config: { extra: { payloadDecKeyHex: 'fixture' } } }), /never bundled/);
});

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

const fontScalePlugin = require('../plugins/with-main-activity-font-scale.js');
const existingConfigChanges = 'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode';
function activityManifest(configChanges = existingConfigChanges) {
  return { manifest: { application: [{ activity: [
    { $: { 'android:name': '.BrowserActivity', 'android:configChanges': 'orientation' } },
    { $: { 'android:name': '.MainActivity', 'android:configChanges': configChanges, 'android:launchMode': 'singleTask' } },
    { $: { 'android:name': 'external.MainActivity', 'android:configChanges': 'screenSize' } },
  ] }] } };
}

test('font-scale retention appends only to the exact Expo MainActivity and preserves existing flags and activities', () => {
  const manifest = activityManifest();
  const before = structuredClone(manifest);
  assert.equal(fontScalePlugin.addMainActivityFontScale(manifest), manifest);
  before.manifest.application[0].activity[1].$['android:configChanges'] += '|fontScale';
  assert.deepEqual(manifest, before);
});

test('font-scale retention is idempotent and retains an already declared flag in its original position', () => {
  for (const flags of [existingConfigChanges, 'fontScale|orientation', 'orientation|fontScale|uiMode']) {
    const manifest = activityManifest(flags);
    fontScalePlugin.addMainActivityFontScale(manifest);
    const once = structuredClone(manifest);
    fontScalePlugin.addMainActivityFontScale(manifest);
    assert.deepEqual(manifest, once);
    const actual = manifest.manifest.application[0].activity[1].$['android:configChanges'];
    assert.equal(actual.split('|').filter(flag => flag === 'fontScale').length, 1);
    if (flags.includes('fontScale')) assert.equal(actual, flags);
  }
});

test('font-scale retention handles an absent MainActivity flags attribute', () => {
  const manifest = activityManifest();
  delete manifest.manifest.application[0].activity[1].$['android:configChanges'];
  fontScalePlugin.addMainActivityFontScale(manifest);
  assert.equal(manifest.manifest.application[0].activity[1].$['android:configChanges'], 'fontScale');
});

test('font-scale retention fails safely for missing or ambiguous MainActivity and malformed flags', () => {
  const missing = activityManifest();
  missing.manifest.application[0].activity.splice(1, 1);
  const duplicate = activityManifest();
  duplicate.manifest.application[0].activity.push({ $: { 'android:name': '.MainActivity' } });
  for (const manifest of [missing, duplicate, activityManifest(7)]) {
    const before = structuredClone(manifest);
    assert.throws(() => fontScalePlugin.addMainActivityFontScale(manifest), /MainActivity/);
    assert.deepEqual(manifest, before);
  }
});

test('the registered Expo manifest mod performs the exact mutation without prebuild or file access', async () => {
  const config = fontScalePlugin({});
  const result = await config.mods.android.manifest({ modResults: activityManifest(), modRequest: {} });
  assert.equal(result.modResults.manifest.application[0].activity[1].$['android:configChanges'], `${existingConfigChanges}|fontScale`);
  assert.equal(result.modResults.manifest.application[0].activity[0].$['android:configChanges'], 'orientation');
});

test('sideload and Play register the font-scale plugin once while preserving existing plugins', () => {
  const plugin = './plugins/with-main-activity-font-scale';
  const retained = ['existing-plugin', ['existing-options', { retained: true }], plugin];
  for (const channel of ['sideload', 'play']) {
    const config = configFor(channel, undefined, undefined, undefined, { ...staticConfig.expo, plugins: retained });
    assert.deepEqual(config.plugins.slice(0, retained.length), retained);
    assert.equal(config.plugins.filter(entry => (Array.isArray(entry) ? entry[0] : entry) === plugin).length, 1);
    assert.ok(configFor(channel).plugins.includes(plugin));
  }
});
