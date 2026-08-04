import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function parseAaptBadging(output) {
  const line = String(output || '').split(/\r?\n/).find((item) => item.startsWith('package:')) || '';
  const value = (name) => new RegExp(`${name}='([^']+)'`).exec(line)?.[1] || '';
  return {
    packageName: value('name'),
    versionCode: value('versionCode'),
    versionName: value('versionName'),
  };
}

export function parseApksignerCertificateSha256(output) {
  const matches = [...String(output || '').matchAll(/Signer #\d+ certificate SHA-256 digest:\s*([A-Fa-f0-9:]+)/g)]
    .map((match) => match[1].replaceAll(':', '').toLowerCase());
  const unique = [...new Set(matches)];
  if (unique.length !== 1 || !/^[a-f0-9]{64}$/.test(unique[0] || '')) {
    throw new Error(`Expected exactly one APK signing certificate, found ${unique.length}`);
  }
  return unique[0];
}

function androidTool(name) {
  const override = process.env[`ANDROID_${name.toUpperCase()}`]?.trim();
  if (override) return override;
  const root = process.env.ANDROID_HOME?.trim() || process.env.ANDROID_SDK_ROOT?.trim();
  if (root) {
    const buildTools = join(root, 'build-tools');
    if (existsSync(buildTools)) {
      for (const version of readdirSync(buildTools).sort().reverse()) {
        const candidates = process.platform === 'win32'
          ? [`${name}.exe`, `${name}.bat`, name]
          : [name];
        for (const candidateName of candidates) {
          const candidate = join(buildTools, version, candidateName);
          if (existsSync(candidate)) return candidate;
        }
      }
    }
  }
  return name;
}

function runTool(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  if (result.error || result.status !== 0) {
    throw new Error(
      `APK identity tool failed (${command}): ${result.error?.message || result.stderr || `exit ${result.status}`}`,
    );
  }
  return `${result.stdout || ''}\n${result.stderr || ''}`;
}

export function inspectApkIdentity(apkPath, expected) {
  const badging = parseAaptBadging(runTool(androidTool('aapt'), ['dump', 'badging', apkPath]));
  if (!badging.packageName) throw new Error('aapt did not report an APK package name');
  if (badging.packageName !== expected.packageName) {
    throw new Error(`APK package mismatch (expected ${expected.packageName}, got ${badging.packageName})`);
  }
  if (badging.versionName !== expected.versionName) {
    throw new Error(`APK version mismatch (expected ${expected.versionName}, got ${badging.versionName})`);
  }
  if (badging.versionCode !== String(expected.versionCode)) {
    throw new Error(`APK build mismatch (expected ${expected.versionCode}, got ${badging.versionCode})`);
  }
  const certificateSha256 = parseApksignerCertificateSha256(
    runTool(androidTool('apksigner'), ['verify', '--verbose', '--print-certs', apkPath]),
  );
  return { ...badging, certificateSha256 };
}
