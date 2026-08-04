import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export function parseAaptBadging(output) {
  const lines = String(output || '').split(/\r?\n/);
  const line = lines.find((item) => item.startsWith('package:')) || '';
  const value = (name) => new RegExp(`${name}='([^']+)'`).exec(line)?.[1] || '';
  const nativeCodeLine = lines.find((item) => item.startsWith('native-code:')) || '';
  return {
    packageName: value('name'),
    versionCode: value('versionCode'),
    versionName: value('versionName'),
    supportedAbis: [...nativeCodeLine.matchAll(/'([^']+)'/g)].map((match) => match[1]),
  };
}

export function parseApksignerCertificateSha256(output) {
  const matches = [
    ...String(output || '').matchAll(
      /^(?:Signer #\d+\s+)?certificate SHA[\t -]?256 digest[\t ]*[:=][\t ]*((?:[A-Fa-f0-9]{2}[: ]?){32})[\t ]*$/gim,
    ),
  ].map((match) => match[1].replace(/[^A-Fa-f0-9]/g, '').toLowerCase());
  const unique = [...new Set(matches)];
  if (unique.length !== 1 || !/^[a-f0-9]{64}$/.test(unique[0] || '')) {
    const labels = String(output || '')
      .split(/\r?\n/)
      .filter((line) => /certificate|signer|verified/i.test(line))
      .slice(0, 20)
      .join(' | ');
    throw new Error(
      `Expected exactly one APK signing certificate, found ${unique.length}` +
      (labels ? `; apksigner reported: ${labels}` : ''),
    );
  }
  return unique[0];
}

export function assertExpectedSigningCertificate(actual, expected) {
  const normalizedActual = String(actual || '').replaceAll(':', '').toLowerCase();
  const normalizedExpected = String(expected || '').replaceAll(':', '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedExpected)) {
    throw new Error('Trusted APK signing certificate is missing or invalid');
  }
  if (normalizedActual !== normalizedExpected) {
    throw new Error(
      `APK signing certificate mismatch (expected ${normalizedExpected}, got ${normalizedActual || 'missing'})`,
    );
  }
}

export function assertExpectedAbis(actual, expected) {
  const normalize = (values) => [...new Set((values ?? []).map((value) => String(value).trim()).filter(Boolean))].sort();
  const normalizedActual = normalize(actual);
  const normalizedExpected = normalize(expected);
  if (!normalizedExpected.length) throw new Error('Trusted APK ABI list is missing or invalid');
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    throw new Error(
      `APK ABI mismatch (expected ${normalizedExpected.join(', ')}, got ${normalizedActual.join(', ') || 'none'})`,
    );
  }
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
  const windowsBatch = process.platform === 'win32' && /\.(?:bat|cmd)$/i.test(command);
  const executable = windowsBatch ? process.env.ComSpec || 'cmd.exe' : command;
  const toolArgs = windowsBatch ? ['/d', '/s', '/c', command, ...args] : args;
  const result = spawnSync(executable, toolArgs, {
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });
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
  assertExpectedAbis(badging.supportedAbis, expected.supportedAbis);
  const certificateSha256 = parseApksignerCertificateSha256(
    runTool(androidTool('apksigner'), ['verify', '--verbose', '--print-certs', apkPath]),
  );
  assertExpectedSigningCertificate(certificateSha256, expected.certificateSha256);
  return { ...badging, certificateSha256 };
}
