import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import type { CorePayload, Manifest } from '../src/types';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { evaluateAppHealthDataQuality } from '../src/lib/appHealth/dataQuality';
import { CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT } from '../src/lib/appHealth/sourceContract';
import { validatePayloadAccounting } from '../src/lib/appHealth/payloadAccounting';
import type { AppHealthDataSnapshot } from '../src/lib/appHealth/types';

const dir = path.resolve(__dirname, '../__fixtures__/public-2026-09-11');
const bytes = fs.readFileSync(path.join(dir, 'core.json.gz'));
const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as Manifest;

function fixture() {
  const raw = JSON.parse(gunzipSync(bytes).toString('utf8')) as CorePayload;
  const allRows = Object.values(raw.sections).flatMap((s) => s.rates);
  const publishedProducts = new Set(allRows.map((r) => r.product_key)).size;
  const accounting = {
    schema_version: 1, source_products: manifest.counts.products, source_rates: manifest.counts.rates,
    published_rates: allRows.length, excluded_rates: 159, exclusions: { discount_not_absolute_rate: 159 },
    published_products: publishedProducts, products_without_published_rates: manifest.counts.products - publishedProducts,
    providers_with_products: 103, providers_with_published_rates: new Set(allRows.map((r) => r.provider)).size,
    sections: { ...Object.fromEntries(Object.entries(raw.sections).map(([section, s]) => [section, {
      source_rates: s.rates.length + (section === 'Mortgage' ? 159 : 0), published_rates: s.rates.length,
      excluded_rates: section === 'Mortgage' ? 159 : 0,
      exclusions: section === 'Mortgage' ? { discount_not_absolute_rate: 159 } : {},
      published_products: new Set(s.rates.map((r) => r.product_key)).size,
      published_providers: new Set(s.rates.map((r) => r.provider)).size,
    }])), Other: { source_rates: 0, published_rates: 0, excluded_rates: 0, exclusions: {}, published_products: 0, published_providers: 0 } },
  };
  raw.coverage!.payload_accounting = accounting;
  const normalized = normalizeCoreWithIntegrity(raw, { coreSha256: manifest.files.core.sha256 });
  const coreProducts = new Set(Object.values(normalized.core.sections).flatMap((s) => s.rates).map((r) => r.product_key)).size;
  const snapshot: AppHealthDataSnapshot = { source: 'remote', core: normalized.core, manifest,
    details: { runDate: raw.run_date, productCount: manifest.counts.products,
      matchedProductCount: coreProducts, orphanProductCount: manifest.counts.products - coreProducts },
    quarantine: { rowsByReason: normalized.integrity.quarantines.rowsByReason,
      bankHistoryPairs: normalized.integrity.quarantines.bankHistoryPairs.size,
      countImpacts: normalized.integrity.quarantines.countImpacts } };
  return { snapshot, accounting };
}

const checks = (snapshot: AppHealthDataSnapshot) => evaluateAppHealthDataQuality(snapshot, CURRENT_V1_APP_HEALTH_SOURCE_CONTRACT);

it('uses unmodified captured public core bytes', () => {
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.files.core.sha256);
});

it('reconciles positive-only ribbons and declared discount exclusions without hiding quarantine or taxonomy', () => {
  const { snapshot } = fixture();
  expect(validatePayloadAccounting(snapshot)).toMatchObject({ present: true, valid: true, excludedRates: 159 });
  const results = checks(snapshot);
  expect(results.find((c) => c.code === 'ribbon-reconciliation')).toMatchObject({ status: 'pass',
    metrics: { invalidSections: 0, explainedSourceRateExclusions: 159 } });
  expect(results.find((c) => c.code === 'details-completeness')?.status).toBe('pass');
  expect(results.find((c) => c.code === 'quarantine-impact')?.status).toBe('warn');
  expect(results.find((c) => c.code === 'taxonomy-roots')?.status).toBe('warn');
});

it('does not excuse unexplained losses or malformed accounting', () => {
  const { snapshot, accounting } = fixture();
  accounting.excluded_rates += 1;
  expect(validatePayloadAccounting(snapshot).valid).toBe(false);
  expect(checks(snapshot).find((c) => c.code === 'ribbon-reconciliation')?.status).toBe('fail');
  expect(checks(snapshot).find((c) => c.code === 'details-completeness')?.status).toBe('warn');
});

it('keeps legacy missing-source reconciliation visible when no explanation was published', () => {
  const { snapshot } = fixture();
  delete snapshot.core!.coverage!.payload_accounting;
  expect(checks(snapshot).find((c) => c.code === 'ribbon-reconciliation')?.status).toBe('fail');
});
