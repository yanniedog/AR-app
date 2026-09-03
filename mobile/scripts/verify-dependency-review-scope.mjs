#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

export const EAS_TOOLCHAIN_MANIFEST = 'mobile/tools/eas-cli/package-lock.json';
export const EAS_TOOLCHAIN_ALLOWED_GHSAS = Object.freeze([
  'GHSA-3ppc-4f35-3m26',
  'GHSA-7r86-cg39-jmmj',
  'GHSA-23c5-xmqv-rm74',
  'GHSA-28wg-ghj8-5hjv',
  'GHSA-2v37-7h3g-55p8',
  'GHSA-xwg4-73v4-xw9w',
  'GHSA-r292-9mhp-454m',
]);

function normalizeManifestPath(value) {
  return String(value ?? '')
    .replaceAll('\\', '/')
    .replace(/^\.\//, '')
    .replace(/^\//, '');
}

export function outOfScopeEasAdvisories(changes) {
  if (!Array.isArray(changes)) {
    throw new Error('Dependency review output must be an array');
  }
  const allowed = new Set(EAS_TOOLCHAIN_ALLOWED_GHSAS);
  const findings = [];
  for (const change of changes) {
    if (change?.change_type !== 'added') continue;
    const manifest = normalizeManifestPath(change?.manifest);
    for (const vulnerability of Array.isArray(change?.vulnerabilities) ? change.vulnerabilities : []) {
      const ghsa = String(vulnerability?.advisory_ghsa_id ?? '').trim();
      if (!allowed.has(ghsa) || manifest === EAS_TOOLCHAIN_MANIFEST) continue;
      findings.push({
        ghsa,
        manifest: manifest || '(missing manifest)',
        package: String(change?.package_url ?? change?.name ?? '(unknown package)'),
      });
    }
  }
  return findings;
}

export function verifyDependencyReviewScope(changes) {
  const findings = outOfScopeEasAdvisories(changes);
  if (findings.length) {
    const detail = findings
      .map((finding) => `${finding.ghsa} in ${finding.package} via ${finding.manifest}`)
      .join('; ');
    throw new Error(`Build-only EAS advisory exception escaped its isolated lockfile: ${detail}`);
  }
  return true;
}

function main() {
  const raw = process.env.DEPENDENCY_CHANGES;
  if (!raw) throw new Error('DEPENDENCY_CHANGES was not provided by dependency review');
  let changes;
  try {
    changes = JSON.parse(raw);
  } catch (error) {
    throw new Error(`DEPENDENCY_CHANGES is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  verifyDependencyReviewScope(changes);
  console.log('verify-dependency-review-scope: EAS advisory exceptions are confined to the build-only toolchain');
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  try {
    main();
  } catch (error) {
    console.error(`verify-dependency-review-scope: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
