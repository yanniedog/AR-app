import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
}

test('production dependencies omit dev-client without changing development installs', async () => {
  const packageJson = await readJson('../package.json');
  const lock = await readJson('../package-lock.json');
  const devClientVersion = packageJson.optionalDependencies['expo-dev-client'];

  assert.equal(packageJson.dependencies['expo-dev-client'], undefined);
  assert.match(devClientVersion, /^~?\d+\.\d+\.\d+$/);
  assert.equal(lock.packages[''].optionalDependencies['expo-dev-client'], devClientVersion);
  assert.equal(lock.packages['node_modules/expo-dev-client'].optional, true);
  assert.equal(lock.packages['node_modules/expo-dev-launcher'].optional, true);
});

test('consumer builds omit the abandoned account and remote key-service stack', async () => {
  const packageJson = await readJson('../package.json');
  const lock = await readJson('../package-lock.json');
  const appConfig = await readJson('../app.json');
  const plugins = appConfig.expo.plugins.map((plugin) =>
    Array.isArray(plugin) ? plugin[0] : plugin,
  );

  assert.equal(packageJson.dependencies['@react-native-firebase/auth'], undefined);
  assert.equal(packageJson.dependencies['@react-native-google-signin/google-signin'], undefined);
  assert.equal(lock.packages['node_modules/@react-native-firebase/auth'], undefined);
  assert.equal(lock.packages['node_modules/@react-native-google-signin/google-signin'], undefined);
  assert.equal(plugins.includes('@react-native-google-signin/google-signin'), false);
  assert.equal(appConfig.expo.extra.googleWebClientId, undefined);
  assert.equal(appConfig.expo.extra.keyServiceUrl, undefined);
  await assert.rejects(
    access(new URL('../../firebase/functions/package.json', import.meta.url)),
    { code: 'ENOENT' },
  );
});

test('release APKs shrink code/resources but keep the Hermes bundle uncompressed', async () => {
  const appConfig = await readJson('../app.json');
  const buildProperties = appConfig.expo.plugins
    .find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties')?.[1];

  assert.equal(buildProperties.android.enableMinifyInReleaseBuilds, true);
  assert.equal(buildProperties.android.enableShrinkResourcesInReleaseBuilds, true);
  assert.equal(buildProperties.android.enablePngCrunchInReleaseBuilds, true);
  assert.notEqual(buildProperties.android.enableBundleCompression, true);
});

test('GHA and EAS production APK paths omit optional development tooling', async () => {
  const workflow = await readFile(
    new URL('../../.github/workflows/mobile-android-apk.yml', import.meta.url),
    'utf8',
  );
  const eas = await readJson('../eas.json');

  assert.match(workflow, /npm ci --omit=optional --no-audit --no-fund/);
  assert.match(workflow, /setup-gradle@9c971963bec38e04b3d30dcc455b5382be2fdbfb/);
  assert.match(workflow, /assembleRelease --no-daemon --build-cache/);
  assert.equal(eas.build.development.env?.NPM_CONFIG_OMIT, undefined);
  assert.equal(eas.build.preview.env.NPM_CONFIG_OMIT, 'optional');
  assert.equal(eas.build.production.env.NPM_CONFIG_OMIT, 'optional');
});

test('the ARM size budget locks in the optimized two-ABI APK', async () => {
  const budgets = await readJson('../performance-budgets.json');
  assert.equal(budgets.apkBaselineByChannel.arm, 48_000_000);
  assert.equal(budgets.maximumGrowthFraction, 0.05);
});

test('EAS release jobs can verify the merged pull request for their main commit', async () => {
  const buildWorkflow = await readFile(
    new URL('../../.github/workflows/mobile-eas-build.yml', import.meta.url),
    'utf8',
  );
  const submitWorkflow = await readFile(
    new URL('../../.github/workflows/mobile-eas-submit.yml', import.meta.url),
    'utf8',
  );

  assert.match(buildWorkflow, /pull-requests:\s+read/);
  assert.match(submitWorkflow, /pull-requests:\s+read/);
});

test('EAS submission validates an environment-delivered build UUID', async () => {
  const submitWorkflow = await readFile(
    new URL('../../.github/workflows/mobile-eas-submit.yml', import.meta.url),
    'utf8',
  );

  assert.match(submitWorkflow, /EAS_BUILD_ID:\s+\$\{\{ inputs\.build_id \}\}/);
  assert.match(submitWorkflow, /build_id must be an exact EAS build UUID/);
  assert.match(submitWorkflow, /--id "\$EAS_BUILD_ID"/);
  assert.doesNotMatch(submitWorkflow, /--id "\$\{\{ inputs\.build_id \}\}"/);
});
