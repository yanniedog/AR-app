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

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} was not provided`);
  return value;
}

/** Fetch dependency changes page-by-page instead of overflowing the runner's
 * process argument limit with the action's complete JSON output. */
export async function fetchDependencyChanges({
  repository,
  baseSha,
  headSha,
  token,
  fetchImpl = fetch,
  perPage = 100,
  maxPages = 100,
}) {
  if (!/^[^/\s]+\/[^/\s]+$/.test(repository)) {
    throw new Error('GITHUB_REPOSITORY must be an owner/name pair');
  }
  if (!/^[0-9a-f]{40}$/i.test(baseSha) || !/^[0-9a-f]{40}$/i.test(headSha)) {
    throw new Error('Dependency review base and head must be full commit SHAs');
  }
  if (!token?.trim()) throw new Error('GITHUB_TOKEN was not provided');
  if (!Number.isSafeInteger(perPage) || perPage < 1 || perPage > 100) {
    throw new Error('perPage must be an integer from 1 to 100');
  }

  const changes = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(
      `https://api.github.com/repos/${repository}/dependency-graph/compare/${baseSha}...${headSha}`,
    );
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('page', String(page));
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) {
      const detail = String(await response.text()).slice(0, 500);
      throw new Error(`GitHub dependency comparison failed with HTTP ${response.status}: ${detail}`);
    }
    const pageChanges = await response.json();
    if (!Array.isArray(pageChanges)) {
      throw new Error('GitHub dependency comparison did not return an array');
    }
    changes.push(...pageChanges);
    if (pageChanges.length < perPage) return changes;
  }
  throw new Error(`GitHub dependency comparison exceeded ${maxPages} pages`);
}

export async function loadDependencyChanges() {
  const raw = process.env.DEPENDENCY_CHANGES;
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      throw new Error(`DEPENDENCY_CHANGES is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return fetchDependencyChanges({
    repository: requiredEnvironment('GITHUB_REPOSITORY'),
    baseSha: requiredEnvironment('DEPENDENCY_REVIEW_BASE_SHA'),
    headSha: requiredEnvironment('DEPENDENCY_REVIEW_HEAD_SHA'),
    token: requiredEnvironment('GITHUB_TOKEN'),
  });
}

async function main() {
  const changes = await loadDependencyChanges();
  verifyDependencyReviewScope(changes);
  console.log('verify-dependency-review-scope: EAS advisory exceptions are confined to the build-only toolchain');
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  main().catch((error) => {
    console.error(`verify-dependency-review-scope: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
