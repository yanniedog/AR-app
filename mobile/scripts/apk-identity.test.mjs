import assert from 'node:assert/strict';
import childProcess, { spawnSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  assertExpectedAbis,
  assertExpectedSigningCertificate,
  inspectApkIdentity,
  parseAaptBadging,
  parseApksignerCertificateSha256,
  resolveToolInvocation,
  toolSpawnPlan,
} from './apk-identity.mjs';
import {
  fetchRemoteManifest,
  releaseFloorTags,
  validateReusedReleaseIdentity,
} from './bump-android-version-code.mjs';

test('runs SDK tools as an argument array and never through cmd.exe', () => {
  assert.deepEqual(
    resolveToolInvocation('C:\\Android\\build-tools\\aapt.exe', ['dump', 'badging', 'app.apk']),
    {
      executable: 'C:\\Android\\build-tools\\aapt.exe',
      args: ['dump', 'badging', 'app.apk'],
    },
  );
  assert.throws(
    () => resolveToolInvocation('C:\\Android\\aapt.bat', ['dump', 'badging', 'app.apk']),
    /cmd\.exe/,
  );

  const sdk = mkdtempSync(join(tmpdir(), 'apk-identity-'));
  try {
    writeFileSync(join(sdk, 'apksigner.bat'), '@echo off\r\n');
    mkdirSync(join(sdk, 'lib'));
    const jar = join(sdk, 'lib', 'apksigner.jar');
    writeFileSync(jar, '');
    const plan = toolSpawnPlan(join(sdk, 'apksigner.bat'), ['verify', '--print-certs', 'app.apk']);
    assert.equal(plan.options.shell, false);
    assert.equal(plan.options.windowsHide, true);
    assert.doesNotMatch(plan.executable, /\.(?:bat|cmd)$/i);
    assert.deepEqual(plan.args.slice(0, 2), ['-jar', jar]);
    assert.deepEqual(plan.args.slice(2), ['verify', '--print-certs', 'app.apk']);
  } finally {
    rmSync(sdk, { recursive: true, force: true });
  }
});

test('strips surrounding quotes from JAVA_HOME before locating java', () => {
  const sdk = mkdtempSync(join(tmpdir(), 'apk-identity-java-'));
  const home = join(sdk, 'jdk');
  const previous = process.env.JAVA_HOME;
  try {
    mkdirSync(join(home, 'bin'), { recursive: true });
    mkdirSync(join(sdk, 'lib'), { recursive: true });
    const java = join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
    writeFileSync(java, '');
    writeFileSync(join(sdk, 'apksigner.bat'), '');
    writeFileSync(join(sdk, 'lib', 'apksigner.jar'), '');
    process.env.JAVA_HOME = `"${home}"`;
    const plan = resolveToolInvocation(join(sdk, 'apksigner.bat'), ['verify']);
    assert.equal(plan.executable, java);
  } finally {
    if (previous === undefined) delete process.env.JAVA_HOME;
    else process.env.JAVA_HOME = previous;
    rmSync(sdk, { recursive: true, force: true });
  }
});

test('APK inspection spawns both tools without interpreting shell metacharacters', (t) => {
  const sdk = mkdtempSync(join(tmpdir(), 'apk-identity-spawn-'));
  const oldAapt = process.env.ANDROID_AAPT;
  const oldSigner = process.env.ANDROID_APKSIGNER;
  const apk = join(sdk, 'app & echo "untrusted".apk');
  const certificate = 'ab'.repeat(32);
  const calls = [];
  const mocked = t.mock.method(childProcess, 'spawnSync', (executable, args, options) => {
    calls.push({ executable, args, options });
    return { status: 0, stdout: calls.length === 1
      ? "package: name='com.example.test' versionCode='1' versionName='1.0'\nnative-code: 'arm64-v8a'"
      : `Signer #1 certificate SHA-256 digest: ${certificate}`, stderr: '' };
  });
  syncBuiltinESMExports();
  try {
    mkdirSync(join(sdk, 'lib'));
    writeFileSync(join(sdk, 'lib', 'apksigner.jar'), '');
    process.env.ANDROID_AAPT = join(sdk, 'aapt & literal.exe');
    process.env.ANDROID_APKSIGNER = join(sdk, 'apksigner.bat');
    inspectApkIdentity(apk, { packageName: 'com.example.test', versionName: '1.0',
      versionCode: 1, supportedAbis: ['arm64-v8a'], certificateSha256: certificate });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].executable, process.env.ANDROID_AAPT);
    assert.deepEqual(calls[0].args, ['dump', 'badging', apk]);
    assert.deepEqual(calls[1].args, ['-jar', join(sdk, 'lib', 'apksigner.jar'),
      'verify', '--verbose', '--print-certs', apk]);
    for (const call of calls) {
      assert.equal(call.options.shell, false);
      assert.equal(call.options.windowsHide, true);
      assert.doesNotMatch(call.executable, /(?:cmd\.exe|\.(?:bat|cmd))$/i);
    }
  } finally {
    mocked.mock.restore();
    syncBuiltinESMExports();
    if (oldAapt === undefined) delete process.env.ANDROID_AAPT;
    else process.env.ANDROID_AAPT = oldAapt;
    if (oldSigner === undefined) delete process.env.ANDROID_APKSIGNER;
    else process.env.ANDROID_APKSIGNER = oldSigner;
    rmSync(sdk, { recursive: true, force: true });
  }
});

test('parses the package and version identity reported by aapt', () => {
  assert.deepEqual(
    parseAaptBadging([
      "package: name='com.eyex.australianrates' versionCode='196' versionName='1.0.83' platformBuildVersionName='15'",
      "native-code: 'armeabi-v7a' 'arm64-v8a'",
    ].join('\n')),
    {
      packageName: 'com.eyex.australianrates',
      versionCode: '196',
      versionName: '1.0.83',
      supportedAbis: ['armeabi-v7a', 'arm64-v8a'],
    },
  );
});

test('requires exactly the configured release ABIs', () => {
  const expected = ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'];
  assert.doesNotThrow(() => assertExpectedAbis([...expected].reverse(), expected));
  assert.throws(() => assertExpectedAbis(expected.slice(0, 2), expected), /APK ABI mismatch/i);
  assert.throws(() => assertExpectedAbis([], expected), /APK ABI mismatch/i);
});

test('reports a missing rolling-tag CLI value explicitly', () => {
  const script = fileURLToPath(new URL('./bump-android-version-code.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--rolling-tag'], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing value for --rolling-tag/);
});

test('bounds each release-floor manifest request independently', async () => {
  await assert.rejects(
    () => fetchRemoteManifest(
      'owner/repo',
      'app-apk-arm-latest',
      5,
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
    ),
    /manifest request timed out/i,
  );

  const universal = await fetchRemoteManifest(
    'owner/repo',
    'app-apk-latest',
    5,
    async () => ({
      ok: true,
      status: 200,
      json: async () => ({ version: '1.0.84', build_number: '205' }),
    }),
  );
  assert.deepEqual(universal, { version: '1.0.84', buildNumber: 205 });
  assert.deepEqual(
    releaseFloorTags('app-apk-arm-latest'),
    ['app-apk-arm-latest', 'app-apk-latest'],
  );
  assert.deepEqual(
    releaseFloorTags('app-apk-latest'),
    ['app-apk-latest', 'app-apk-arm-latest'],
  );
});

test('reuses one monotonic release identity across paired APK channels', () => {
  assert.deepEqual(validateReusedReleaseIdentity({
    version: '1.0.181',
    versionCode: '193',
    baseVersion: '1.0.180',
    baseVersionCode: 192,
  }), { version: '1.0.181', versionCode: 193 });
  assert.deepEqual(validateReusedReleaseIdentity({
    version: '1.0.180',
    versionCode: '192',
    baseVersion: '1.0.180',
    baseVersionCode: 192,
  }), { version: '1.0.180', versionCode: 192 });
  assert.throws(() => validateReusedReleaseIdentity({
    version: '1.0.181',
    versionCode: '',
    baseVersion: '1.0.180',
    baseVersionCode: 192,
  }), /provided together/);
  assert.throws(() => validateReusedReleaseIdentity({
    version: '1.0.180',
    versionCode: '193',
    baseVersion: '1.0.180',
    baseVersionCode: 192,
  }), /exactly match.*or advance/);
});

test('rejects a missing rolling tag before generating changelog metadata', () => {
  const script = fileURLToPath(new URL('./ensure-changelog-entry.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script, '--rolling-tag'], { encoding: 'utf8' });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing value for --rolling-tag/);
});

test('keeps universal trust while scoping preview APK builds to ARM', () => {
  const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  const easJson = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
  const releaseIdentity = JSON.parse(
    readFileSync(new URL('../release-identity.json', import.meta.url), 'utf8'),
  );
  const buildProperties = appJson.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
  )?.[1];
  assert.deepEqual(
    releaseIdentity.android_release_abis,
    ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'],
  );
  assert.equal(buildProperties?.android?.buildArchs, undefined);
  assert.equal(
    easJson.build.preview.android.gradleCommand,
    ':app:assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a',
  );
  assert.equal(easJson.build.development.android.gradleCommand, undefined);
  assert.equal(easJson.build.production.android.gradleCommand, undefined);
  const workflow = readFileSync(
    new URL('../../.github/workflows/mobile-android-apk.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /default: arm/);
  assert.match(workflow, /if \[ "\$APK_CHANNEL" = "arm" \]; then/);
  assert.match(workflow, /-PreactNativeArchitectures=armeabi-v7a,arm64-v8a/);
  assert.match(workflow, /--rolling-tag "\$rolling_tag"/);
  assert.match(workflow, /inputs\.apk_channel == 'universal'/);
  assert.doesNotMatch(workflow, /bridge_legacy_ar_local|AR_LOCAL_RELEASE_TOKEN|--repo yanniedog\/AR-local/);
  assert.match(workflow, /Publish README Android install QR section/);

  const easWorkflow = readFileSync(
    new URL('../../.github/workflows/mobile-eas-build.yml', import.meta.url),
    'utf8',
  );
  assert.match(easWorkflow, /--rolling-tag app-apk-arm-latest/);
  assert.equal(easWorkflow.match(/--rolling-tag app-apk-arm-latest/g)?.length, 2);
});

test('normalizes exactly one apksigner certificate digest', () => {
  const digest = 'AA:'.repeat(31) + 'AA';
  assert.equal(
    parseApksignerCertificateSha256(`Signer #1 certificate SHA-256 digest: ${digest}`),
    'aa'.repeat(32),
  );
  assert.equal(
    parseApksignerCertificateSha256(`Certificate SHA 256 digest = ${digest}`),
    'aa'.repeat(32),
  );
  assert.equal(
    parseApksignerCertificateSha256(`Certificate SHA-256 digest: ${'bb '.repeat(32)}`),
    'bb'.repeat(32),
  );
  assert.equal(
    parseApksignerCertificateSha256(`V2 Signer: certificate SHA-256 digest: ${digest}`),
    'aa'.repeat(32),
  );
  assert.equal(
    parseApksignerCertificateSha256([
      `Signer #1 certificate SHA-256 digest: ${digest}`,
      `Source Stamp Signer certificate SHA-256 digest: ${'cc:'.repeat(31)}cc`,
    ].join('\n')),
    'aa'.repeat(32),
  );
  assert.throws(() => parseApksignerCertificateSha256('Verified'), /exactly one/i);
});

test('requires the pinned release signing certificate', () => {
  const trusted = '5f9ab77ef2b0c68307d652abe28dfa96690851af1a28353bb84d277ef83682c1';
  assert.doesNotThrow(() => assertExpectedSigningCertificate(trusted.toUpperCase(), trusted));
  assert.throws(
    () => assertExpectedSigningCertificate('a'.repeat(64), trusted),
    /signing certificate mismatch/i,
  );
});
