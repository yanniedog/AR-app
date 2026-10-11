// Input: producer-packed core, original verified core gzip, and its manifest.
// Only the compact history is bundled; no credentials or catalogue rows.
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { strictEqual } from 'node:assert';
import { isDeepStrictEqual } from 'node:util';
const [packedPath, originalPath, manifestPath, outputPath] = process.argv.slice(2);
if (!outputPath) throw new Error('Usage: node bundle-bank-rate-history.mjs packed-core.json original-core.gz manifest.json output.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const original = await readFile(originalPath);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
strictEqual(digest(original), manifest.files.core.sha256, 'Source core hash');
const packed = JSON.parse(await readFile(packedPath, 'utf8'));
const { bank_rate_history: history, ...catalogue } = packed;
if (!isDeepStrictEqual(catalogue, JSON.parse(gunzipSync(original)))) throw new Error('Catalogue facts must be unchanged');
strictEqual(history.run_dates.at(-1), manifest.run_date);
const bytes = Buffer.from(JSON.stringify(history));
const artifact = { schema_version: 1, run_date: manifest.run_date, core_sha256: manifest.files.core.sha256,
  source_manifest_url: manifest.files.core.url.replace(/[^/]+$/, 'manifest.json'),
  history_sha256: digest(bytes), gzip_hex: gzipSync(bytes, { level: 9 }).toString('hex') };
await writeFile(outputPath, JSON.stringify(artifact) + '\n');
console.log(JSON.stringify({ run_date: artifact.run_date, dates: history.run_dates.length, gzip_bytes: artifact.gzip_hex.length / 2, history_sha256: artifact.history_sha256 }));
