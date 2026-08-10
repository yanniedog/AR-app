// Bundled fallback payload so the app shows real data offline and before the
// first GitHub release is published. These JSON files are generated from a real
// Pi export by `npm run sample` (mobile/scripts/build-sample.mjs). Kept as a .js
// shim (with a matching sample.d.ts) so TypeScript never parses the multi-MB
// JSON literals — Metro still bundles them at build time.
const sampleManifest = require('../../assets/sample/manifest.json');
const { normalizeCoreSectionIntegrity } = require('./sectionIntegrity');
const SAMPLE_MAX_AGE_DAYS = 180;
const sampleCore = normalizeCoreSectionIntegrity(require('../../assets/sample/core.json'));

function sampleManifestIsUsable(manifest, now = new Date()) {
  // generated_at is an absolute instant; run_date is a Hobart calendar date
  // and can legitimately be one day ahead of UTC during the overnight ingest.
  const observed = Date.parse(manifest?.generated_at ?? `${manifest?.run_date ?? ''}T00:00:00Z`);
  const ageMs = now.getTime() - observed;
  return Number.isFinite(observed) && ageMs >= 0 && ageMs <= SAMPLE_MAX_AGE_DAYS * 86400000;
}

module.exports = {
  sampleManifest,
  SAMPLE_MAX_AGE_DAYS,
  sampleCore,
  loadSampleDetails: () => require('../../assets/sample/details.json'),
  sampleManifestIsUsable,
  sampleFallbackIsUsable: (now = new Date()) => sampleManifestIsUsable(sampleManifest, now),
};
