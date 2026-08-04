// Install a producer-generated historical sample bundle. Product selection,
// aggregate calculation, and manifest construction belong to AR-local.
//
//   npm run sample -- C:\path\to\ar-local\generated-sample
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const defaultOutputDir = resolve(here, '..', 'assets', 'sample');
const LIMITS = { core: 2 * 1024 * 1024, details: 8 * 1024 * 1024 };

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function validateGeneratedSample(sourceDir) {
  const manifestBytes = await readFile(join(sourceDir, 'manifest.json'));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  if (manifest.schema_version !== 1 || !/^\d{4}-\d{2}-\d{2}$/.test(manifest.run_date ?? '')) {
    throw new Error('Generated sample manifest must be schema version 1 with an ISO run_date.');
  }
  if (manifest.repo !== 'yanniedog/AR-local' || manifest.tag !== 'bundled-sample') {
    throw new Error('Generated sample must identify AR-local and the bundled-sample contract.');
  }
  if (Object.keys(manifest.files ?? {}).sort().join(',') !== 'core,details') {
    throw new Error('Generated sample manifest may contain only core and details files.');
  }

  const artifacts = {};
  for (const kind of ['core', 'details']) {
    const expectedName = `${kind}.json`;
    const entry = manifest.files[kind];
    if (entry?.name !== expectedName || entry.url !== `bundled://sample/${expectedName}` || entry.enc) {
      throw new Error(`${kind} must use the local ${expectedName} bundled-sample contract.`);
    }
    const bytes = await readFile(join(sourceDir, expectedName));
    if (bytes.length !== entry.bytes) throw new Error(`${kind} byte count mismatch.`);
    if (bytes.length > LIMITS[kind]) throw new Error(`${kind} exceeds the bundled-sample size limit.`);
    if (sha256(bytes) !== entry.sha256) throw new Error(`${kind} SHA-256 mismatch.`);
    const payload = JSON.parse(bytes.toString('utf8'));
    if (payload.schema_version !== 1 || payload.run_date !== manifest.run_date) {
      throw new Error(`${kind} schema/run_date does not match manifest.`);
    }
    artifacts[kind] = { bytes, payload };
  }

  const limitations = artifacts.core.payload.coverage?.limitations ?? [];
  if (!limitations.some((value) => /bundled sample/i.test(String(value)))) {
    throw new Error('Generated core must declare its bundled-sample limitation.');
  }
  const rateCount = Object.values(artifacts.core.payload.sections ?? {})
    .reduce((sum, section) => sum + (section.rates?.length ?? 0), 0);
  const productCount = Object.keys(artifacts.details.payload.products ?? {}).length;
  if (manifest.counts?.rates !== rateCount || manifest.counts?.products !== productCount) {
    throw new Error('Generated sample counts do not match core/details payloads.');
  }
  return { artifacts, manifest, manifestBytes, productCount, rateCount };
}

export async function installSample(sourceDir, outputDir = defaultOutputDir) {
  const validated = await validateGeneratedSample(resolve(sourceDir));
  await mkdir(outputDir, { recursive: true });
  for (const kind of ['core', 'details']) {
    await writeFile(join(outputDir, `${kind}.json`), validated.artifacts[kind].bytes);
  }
  // Manifest last: a killed import cannot advertise a partially installed set.
  await writeFile(join(outputDir, 'manifest.json'), validated.manifestBytes);
  return validated;
}

async function main() {
  const sourceArg = process.argv[2];
  if (!sourceArg) {
    throw new Error('Pass an AR-local generated sample directory containing manifest.json, core.json, and details.json.');
  }
  const result = await installSample(sourceArg);
  console.log(
    `sample imported run_date=${result.manifest.run_date} ` +
    `products=${result.productCount} rates=${result.rateCount}`,
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
