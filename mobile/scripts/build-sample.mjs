// Regenerate a deliberately small, historical bundled sample from a built
// AR-local payload directory. The sample is a representative offline preview,
// never a complete or current-market substitute.
//
//   node scripts/build-sample.mjs [pathToAppPayloadDir]
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileDir = resolve(here, '..');
const repoDir = resolve(mobileDir, '..');
const srcDir = process.argv[2]
  ? resolve(process.argv[2])
  : join(repoDir, 'runs', '2026-05-19', '_exports', 'app-payload');
const outDir = join(mobileDir, 'assets', 'sample');
mkdirSync(outDir, { recursive: true });

const sourceManifest = JSON.parse(readFileSync(join(srcDir, 'manifest.json'), 'utf8'));
const readPayload = (kind) => JSON.parse(
  gunzipSync(readFileSync(join(srcDir, sourceManifest.files[kind].name))).toString('utf8'),
);
const sourceCore = readPayload('core');
const sourceDetails = readPayload('details');

const numericRate = (row) => {
  const value = Number(row.comparison_rate || row.rate);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const stats = (rows) => {
  const values = rows.map(numericRate).filter((value) => value !== null).sort((a, b) => a - b);
  if (!values.length) return { min: null, max: null, mean: null, median: null };
  const middle = Math.floor(values.length / 2);
  return {
    min: values[0],
    max: values.at(-1),
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    median: values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2,
  };
};

const representativeRows = (rows, section) => {
  const byProvider = new Map();
  for (const row of rows) {
    const list = byProvider.get(row.provider) ?? [];
    list.push(row);
    byProvider.set(row.provider, list);
  }
  return [...byProvider.values()].flatMap((providerRows) => {
    const sorted = [...providerRows].sort((a, b) => {
      const av = numericRate(a);
      const bv = numericRate(b);
      if (av === null) return 1;
      if (bv === null) return -1;
      return section === 'Mortgage' ? av - bv : bv - av;
    });
    const chosen = [];
    const products = new Set();
    for (const row of sorted) {
      if (products.has(row.product_key)) continue;
      chosen.push(row);
      products.add(row.product_key);
      if (chosen.length === 2) break;
    }
    return chosen;
  });
};

const sections = Object.fromEntries(Object.entries(sourceCore.sections).map(([section, data]) => {
  const rates = representativeRows(data.rates, section);
  const providerGroups = new Map();
  for (const row of rates) {
    const list = providerGroups.get(row.provider) ?? [];
    list.push(row);
    providerGroups.set(row.provider, list);
  }
  const providers = [...providerGroups.entries()].map(([provider, providerRows]) => ({
    provider,
    rates: providerRows.length,
    products: new Set(providerRows.map((row) => row.product_key)).size,
    ...stats(providerRows),
  }));
  return [section, {
    rates,
    ribbon: {
      counts: {
        rates: rates.length,
        products: new Set(rates.map((row) => row.product_key)).size,
        providers: providerGroups.size,
      },
      range: stats(rates),
      providers,
    },
  }];
}));

const selectedProductKeys = new Set(
  Object.values(sections).flatMap((section) => section.rates.map((row) => row.product_key)),
);
const products = Object.fromEntries(
  Object.entries(sourceDetails.products).filter(([key]) => selectedProductKeys.has(key)),
);
const usedProviders = new Set(
  Object.values(sections).flatMap((section) => section.rates.map((row) => row.provider)),
);
const core = {
  ...sourceCore,
  sections,
  brands: Object.fromEntries(
    Object.entries(sourceCore.brands).filter(([provider]) => usedProviders.has(provider)),
  ),
  coverage: {
    ...(sourceCore.coverage ?? {}),
    limitations: [
      ...(sourceCore.coverage?.limitations ?? []),
      'Bundled sample only: up to two representative published products per provider and section; not a complete or current market view.',
    ],
  },
};
const details = { ...sourceDetails, products };
const jsonByKind = { core: JSON.stringify(core), details: JSON.stringify(details) };
const fileMeta = (kind) => ({
  ...sourceManifest.files[kind],
  name: `sample-${kind}.json`,
  bytes: Buffer.byteLength(jsonByKind[kind]),
  sha256: createHash('sha256').update(jsonByKind[kind]).digest('hex'),
});
const detailValues = Object.values(products);
const manifest = {
  ...sourceManifest,
  counts: {
    ...sourceManifest.counts,
    products: selectedProductKeys.size,
    rates: Object.values(sections).reduce((sum, section) => sum + section.rates.length, 0),
    fees: detailValues.reduce((sum, item) => sum + (item.fees?.length ?? 0), 0),
    features: detailValues.reduce((sum, item) => sum + (item.features?.length ?? 0), 0),
    eligibility: detailValues.reduce((sum, item) => sum + (item.eligibility?.length ?? 0), 0),
    constraints: detailValues.reduce((sum, item) => sum + (item.constraints?.length ?? 0), 0),
  },
  files: { ...sourceManifest.files, core: fileMeta('core'), details: fileMeta('details') },
};

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest));
for (const [kind, json] of Object.entries(jsonByKind)) {
  writeFileSync(join(outDir, `${kind}.json`), json);
  console.log(`wrote assets/sample/${kind}.json (${(Buffer.byteLength(json) / 1024) | 0} KiB)`);
}
console.log(`sample run_date=${manifest.run_date} products=${selectedProductKeys.size}`);
