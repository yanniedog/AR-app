import { appendFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const FONT_EXTENSIONS = new Set(['.otf', '.ttf', '.woff', '.woff2']);

async function filesBelow(root) {
  const output = [];
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return output;
    throw error;
  }
  for (const entry of entries) {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) output.push(...await filesBelow(filePath));
    else if (entry.isFile()) output.push(filePath);
  }
  return output;
}

function sumBy(files, predicate) {
  return files.reduce((sum, file) => sum + (predicate(file) ? file.bytes : 0), 0);
}

export async function collectArtifactSizes({
  distDir = path.resolve('dist'),
  apkPaths = [],
} = {}) {
  const distFiles = await Promise.all((await filesBelow(distDir)).map(async (filePath) => ({
    path: filePath,
    relative: path.relative(distDir, filePath).replaceAll('\\', '/'),
    bytes: (await stat(filePath)).size,
  })));
  const assetFiles = distFiles.filter((file) => file.relative.startsWith('assets/'));
  const apkFiles = [];
  for (const apkPath of apkPaths) {
    if (!apkPath) continue;
    try {
      const info = await stat(apkPath);
      if (info.isFile()) apkFiles.push({ path: apkPath, bytes: info.size });
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    androidBundleBytes: sumBy(distFiles, (file) => file.relative.includes('_expo/static/js/android/')),
    iosBundleBytes: sumBy(distFiles, (file) => file.relative.includes('_expo/static/js/ios/')),
    webBundleBytes: sumBy(distFiles, (file) => file.relative.includes('_expo/static/js/web/')),
    fontBytes: sumBy(assetFiles, (file) => FONT_EXTENSIONS.has(path.extname(file.path).toLowerCase())),
    assetBytes: sumBy(assetFiles, () => true),
    apkBytes: apkFiles.length ? Math.max(...apkFiles.map((file) => file.bytes)) : null,
    apkFiles,
  };
}

export function evaluateArtifactBudgets(report, budgetConfig) {
  const growth = Number(budgetConfig.maximumGrowthFraction);
  if (!Number.isFinite(growth) || growth < 0) throw new Error('Invalid maximumGrowthFraction');
  const failures = [];
  for (const [metric, baseline] of Object.entries(budgetConfig.baseline ?? {})) {
    const actual = report[metric];
    // An APK is not produced by Expo export. Report it when supplied by a
    // native/EAS build, but do not make ordinary mobile CI invent one.
    if (actual == null) continue;
    if (!Number.isFinite(baseline) || baseline < 0) throw new Error(`Invalid baseline for ${metric}`);
    const maximum = Math.floor(baseline * (1 + growth));
    if (actual > maximum) failures.push({ metric, actual, baseline, maximum });
  }
  return failures;
}

export function assertApkSizeBudget(apkBytes, budgetConfig) {
  const failure = evaluateArtifactBudgets({ apkBytes }, budgetConfig)
    .find((item) => item.metric === 'apkBytes');
  if (failure) {
    throw new Error(
      `APK size ${failure.actual} bytes exceeds ${failure.maximum} bytes ` +
      `(baseline ${failure.baseline}, +${Number(budgetConfig.maximumGrowthFraction) * 100}%)`,
    );
  }
}

function formatBytes(bytes) {
  if (bytes == null) return 'not built';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
}

export function artifactSizeMarkdown(report, failures = []) {
  const failed = new Set(failures.map((failure) => failure.metric));
  const rows = [
    ['Android JS/Hermes', 'androidBundleBytes'],
    ['iOS JS/Hermes', 'iosBundleBytes'],
    ['Web JS', 'webBundleBytes'],
    ['Exported fonts', 'fontBytes'],
    ['Exported assets', 'assetBytes'],
    ['APK', 'apkBytes'],
  ];
  return [
    '## Mobile artifact sizes',
    '',
    '| Artifact | Size | Budget |',
    '| --- | ---: | --- |',
    ...rows.map(([label, metric]) => `| ${label} | ${formatBytes(report[metric])} | ${failed.has(metric) ? 'over 5% growth limit' : 'ok / reported'} |`),
    '',
  ].join('\n');
}

async function main() {
  const guard = process.argv.includes('--guard');
  const apkPaths = (process.env.AR_APP_APK_PATH ?? '').split(path.delimiter).filter(Boolean);
  const report = await collectArtifactSizes({ apkPaths });
  const budgetConfig = JSON.parse(await readFile(new URL('../performance-budgets.json', import.meta.url), 'utf8'));
  const failures = guard ? evaluateArtifactBudgets(report, budgetConfig) : [];
  const outputPath = path.resolve('dist', 'artifact-sizes.json');
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify({ ...report, failures }, null, 2)}\n`, 'utf8');
  const markdown = artifactSizeMarkdown(report, failures);
  process.stdout.write(`${markdown}\nReport: ${outputPath}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, 'utf8');
  }
  if (failures.length) {
    for (const failure of failures) {
      process.stderr.write(
        `${failure.metric}: ${failure.actual} bytes exceeds ${failure.maximum} bytes ` +
        `(baseline ${failure.baseline}, +5%)\n`,
      );
    }
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main();
}
