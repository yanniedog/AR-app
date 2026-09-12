#!/usr/bin/env node
'use strict';

// Execute the shipping app's pure TypeScript validators in Node, without
// importing Expo or using the device cache. No generated source is checked in.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');
const sourceRoot = path.resolve(__dirname, '../src');
require.extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(sourceRoot + path.sep)) throw new Error('Audit may only load checked-in app sources');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};
const { evaluateAppHealthDataQuality } = require('../src/lib/appHealth/dataQuality.ts');
const { publishedV1SourceContract } = require('../src/lib/appHealth/v1Contract.ts');
const { normalizeCoreWithIntegrity } = require('../src/data/sectionIntegrity.ts');
const { parseDatesIndex } = require('../src/data/datesIndex.ts');
const { assertRevisionManifest, validateRevisionHead } = require('../src/data/payloadRevision.ts');
const { isValidCalendarDate } = require('../src/lib/calendarDate.ts');

const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const MAX_COMPRESSED = 64 * 1024 * 1024;
const MAX_DECODED = 192 * 1024 * 1024;

async function fetchBytes(url, maxBytes) {
  const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const final = new URL(response.url);
  if (final.protocol !== 'https:' || !['github.com', 'objects.githubusercontent.com', 'release-assets.githubusercontent.com'].includes(final.hostname)) {
    throw new Error('Unexpected publication redirect');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Publication response exceeds byte limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function options(args) {
  const out = { repo: 'yanniedog/AR-local', date: null, output: null, directory: null };
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    if (!Object.hasOwn(out, key) || !args[i + 1]) throw new Error('Usage: audit-public-payload.cjs [--repo owner/repo] [--date YYYY-MM-DD] [--directory private-candidate] [--output report.json]');
    out[key] = args[i + 1];
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(out.repo) || (out.date && !isValidCalendarDate(out.date))) throw new Error('Invalid repository or date');
  return out;
}

function privateFile(directory, name, maxBytes) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error('Unsafe candidate filename');
  const filename = path.join(directory, name);
  const stat = fs.lstatSync(filename);
  if (!stat.isFile() || stat.nlink !== 1 || fs.realpathSync(filename) !== filename || stat.size > maxBytes) {
    throw new Error('Candidate file must be a bounded, unique regular file');
  }
  const bytes = fs.readFileSync(filename);
  if (bytes.length > maxBytes) throw new Error('Candidate file exceeds byte limit');
  return bytes;
}

async function audit(opts) {
  const base = `https://github.com/${opts.repo}/releases/download/`;
  const contract = publishedV1SourceContract({
    repo: opts.repo, rollingTag: 'app-payload-latest',
    manifestUrl: `${base}app-payload-latest/manifest.json`,
    datesIndexUrl: `${base}app-payload-latest/dates-index.json`,
    datedTagPrefix: 'app-payload-', schema: 1,
  });
  const directory = opts.directory ? fs.realpathSync(path.resolve(opts.directory)) : null;
  const indexBytes = directory ? null : await fetchBytes(`${contract.datesIndexUrl}?_=${Date.now()}`, 4 * 1024 * 1024);
  const index = indexBytes ? parseDatesIndex(JSON.parse(indexBytes.toString('utf8')), opts.repo) : null;
  if (!directory && !index) throw new Error('Invalid dates index');
  const selectedDate = opts.date ?? index?.latest_date;
  if (index && !index.dates.includes(selectedDate)) throw new Error('Requested date is not published');
  const head = index?.revision_heads?.[selectedDate];
  const manifestUrl = directory ? null : head?.manifest_url ?? (opts.date ? `${base}app-payload-${selectedDate}/manifest.json` : contract.manifestUrl);
  const manifestBytes = directory ? privateFile(directory, 'manifest.json', 4 * 1024 * 1024) : await fetchBytes(manifestUrl, 4 * 1024 * 1024);
  if (head && hash(manifestBytes) !== head.manifest_sha256) throw new Error('Selected manifest sha256 mismatch');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const date = selectedDate ?? manifest.run_date;
  if (!isValidCalendarDate(date)) throw new Error('Invalid candidate date');
  if (head) assertRevisionManifest(manifest, head, date, opts.repo);
  if (directory && manifest.payload_revision) {
    const revision = manifest.payload_revision;
    const binding = validateRevisionHead({ ...revision, manifest_sha256: hash(manifestBytes),
      manifest_url: `${base}${manifest.tag}/manifest.json` }, date, opts.repo);
    assertRevisionManifest(manifest, binding, date, opts.repo);
  }
  if (manifest.run_date !== date || manifest.repo !== opts.repo) throw new Error('Manifest run/repository mismatch');
  const decoded = {};
  const evidence = {};
  const observations = {};
  for (const [key, file] of Object.entries(manifest.files)) {
    try {
      if (!file || !Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > MAX_COMPRESSED ||
          !/^[a-f0-9]{64}$/.test(file.sha256) || typeof file.name !== 'string' ||
          !/^[A-Za-z0-9_.-]+$/.test(file.name) || !file.url.startsWith(base) ||
          new URL(file.url).pathname.split('/').pop() !== file.name || file.enc) throw new Error('Invalid public asset descriptor');
      const bytes = directory ? privateFile(directory, file.name, Math.min(MAX_COMPRESSED, file.bytes + 1))
        : await fetchBytes(file.url, Math.min(MAX_COMPRESSED, file.bytes + 1));
      const digest = hash(bytes);
      if (bytes.length !== file.bytes || digest !== file.sha256) throw new Error('Asset size/hash mismatch');
      const body = bytes[0] === 0x1f && bytes[1] === 0x8b ? zlib.gunzipSync(bytes, { maxOutputLength: MAX_DECODED }) : bytes;
      decoded[key] = JSON.parse(body.toString('utf8'));
      evidence[key] = { status: 'PASS', url: directory ? null : file.url, sha256: digest, bytes: bytes.length,
        decoded_bytes: body.length, acquisition: directory ? 'local_file' : 'public_http' };
      observations[key] = { state: 'ready', runDate: decoded[key].run_date ?? null, itemCount: null };
    } catch (error) {
      evidence[key] = { status: 'FAIL', error: error.message };
      observations[key] = { state: 'failed' };
    }
  }
  const normalized = decoded.core ? normalizeCoreWithIntegrity(decoded.core, { coreSha256: manifest.files.core.sha256 }) : null;
  const coreKeys = new Set(Object.values(normalized?.core.sections ?? {}).flatMap((section) => section.rates).map((row) => row.product_key));
  const detailKeys = Object.keys(decoded.details?.products ?? {});
  const snapshot = {
    source: 'remote', manifest, core: normalized?.core ?? null, appVersion: '1.0.0',
    datesIndex: index ? { dates: index.dates, latestRunDate: index.latest_date } : undefined,
    assets: observations,
    details: decoded.details ? { runDate: decoded.details.run_date, productCount: detailKeys.length,
      matchedProductCount: detailKeys.filter((key) => coreKeys.has(key)).length,
      orphanProductCount: detailKeys.filter((key) => !coreKeys.has(key)).length } : null,
    quarantine: normalized ? { rowsByReason: normalized.integrity.quarantines.rowsByReason,
      bankHistoryPairs: normalized.integrity.quarantines.bankHistoryPairs.size,
      countImpacts: normalized.integrity.quarantines.countImpacts } : null,
  };
  const checks = evaluateAppHealthDataQuality(snapshot, contract);
  if (directory) {
    const sourceCheck = checks.find((check) => check.code === 'data-source-state');
    if (sourceCheck) {
      sourceCheck.metrics.source = 'private_candidate';
      sourceCheck.summary = 'Candidate bytes were read locally; public publication and index selection were not checked.';
    }
  }
  const failed = checks.some((check) => check.status === 'fail') || Object.values(evidence).some((asset) => asset.status === 'FAIL');
  return { schema_version: 1, audited_at: new Date().toISOString(), status: failed ? 'FAIL' : checks.some((check) => check.status !== 'pass') ? 'WARN' : 'PASS',
    acquisition: directory ? 'private_candidate' : 'public_http', publication_verified: !directory && !failed,
    app_commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim(),
    app_worktree_clean: execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=no'], { cwd: sourceRoot, encoding: 'utf8' }).trim() === '',
    run_date: date, manifest_url: manifestUrl, manifest_sha256: hash(manifestBytes), dates_index_sha256: indexBytes ? hash(indexBytes) : null,
    payload_revision: manifest.payload_revision ?? null, assets: evidence, checks };
}

async function main() {
  const opts = options(process.argv.slice(2));
  let report;
  try { report = await audit(opts); }
  catch (error) { report = { schema_version: 1, audited_at: new Date().toISOString(), status: 'BLOCKED', error: error.message }; }
  const json = JSON.stringify(report, null, 2) + '\n';
  if (opts.output) {
    const target = path.resolve(opts.output);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, json);
    const markdown = [`# AR-app ${report.acquisition === 'private_candidate' ? 'private candidate' : 'public payload'} audit`, '', `Status: ${report.status}`, ``,
      report.error ?? `Run: ${report.run_date}; manifest SHA-256: ${report.manifest_sha256}`, '',
      ...(report.checks ?? []).map((check) => `- ${check.status.toUpperCase()} ${check.code}: ${check.label}${check.summary ? ` — ${check.summary}` : ''}`), ''].join('\n');
    fs.writeFileSync(target + '.md', markdown);
  }
  process.stdout.write(json);
  process.exitCode = report.status === 'BLOCKED' ? 3 : report.status === 'FAIL' ? 2 : 0;
}
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 3; });
module.exports = { audit, options };
