// Bundled fallback payload so the app shows real data offline and before the
// first GitHub release is published. These JSON files are generated from a real
// Pi export by `npm run sample` (mobile/scripts/build-sample.mjs). Kept as a .js
// shim (with a matching sample.d.ts) so TypeScript never parses the multi-MB
// JSON literals — Metro still bundles them at build time.
const sampleManifest = require('../../assets/sample/manifest.json');
const SAMPLE_MAX_AGE_DAYS = 180;

module.exports = {
  sampleManifest,
  SAMPLE_MAX_AGE_DAYS,
  sampleCore: require('../../assets/sample/core.json'),
  loadSampleDetails: () => require('../../assets/sample/details.json'),
  sampleFallbackIsUsable: (now = new Date()) => {
    const observed = Date.parse(`${sampleManifest.run_date}T00:00:00Z`);
    return Number.isFinite(observed) && now.getTime() - observed <= SAMPLE_MAX_AGE_DAYS * 86400000;
  },
};
