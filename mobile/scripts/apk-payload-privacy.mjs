import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unzipSync } from 'fflate';

const hash = value => createHash('sha256').update(value).digest('hex');
const MAX_BUNDLE = 32 * 1024 * 1024;
const BOOTSTRAP_NAMES = new Set(['assets/app.manifest', 'assets/app.config']);

/** Bind the shipped bytecode to the actual Gradle output and its module inventory. */
export function verifyApkPayloadPrivacy(apk, bundle, map) {
  if (!bundle.length || bundle.length > MAX_BUNDLE || map?.version !== 3 || !Array.isArray(map.sources) || !map.sources.length) {
    throw new Error('APK bundle privacy evidence is missing or invalid');
  }
  if (map.sources.some(source => /(?:^|\/)assets\/sample\/|(?:^|\/)src\/data\/sample\.js$/.test(String(source).replaceAll('\\', '/')))) {
    throw new Error('APK source contains bundled product data');
  }
  const names = new Set();
  const files = unzipSync(new Uint8Array(apk), { filter(entry) {
    if (names.has(entry.name)) throw new Error('Duplicate APK archive entry');
    names.add(entry.name);
    if (/(?:^|\/)sample\//i.test(entry.name) || /(?:^|\/)(?:core|details|search-index|terms-index)(?:[.-].*)?\.json(?:\.gz)?$/i.test(entry.name)) {
      throw new Error('APK contains a product dataset asset');
    }
    if (entry.name.startsWith('assets/') && !entry.name.endsWith('/')) {
      const operational = BOOTSTRAP_NAMES.has(entry.name) || entry.name === 'assets/index.android.bundle'
        || /\.(?:png|webp|jpg|jpeg|gif|ttf|otf|woff2?|prof|profm)$/i.test(entry.name);
      if (!operational) throw new Error('Unknown APK asset classification');
    }
    if (BOOTSTRAP_NAMES.has(entry.name)) {
      if (entry.originalSize > 1024 * 1024) throw new Error('APK bootstrap metadata exceeds byte limit');
      return true;
    }
    if (entry.name !== 'assets/index.android.bundle') return false;
    if (entry.originalSize > MAX_BUNDLE) throw new Error('APK runtime exceeds privacy verification byte limit');
    return true;
  } });
  const runtime = files['assets/index.android.bundle'];
  if (!runtime || hash(runtime) !== hash(bundle)) throw new Error('APK runtime does not match the verified native build');
  for (const name of BOOTSTRAP_NAMES) {
    if (!files[name]) continue;
    const bootstrap = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(files[name]));
    const visit = value => {
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (['payloadDecKeyHex', 'key_hex', 'private_key', 'products', 'rates', 'sections'].includes(key)) {
          throw new Error('APK bootstrap contains prohibited key or product fields');
        }
        visit(child);
      }
    };
    visit(bootstrap);
  }
  return { schema_version: 1, apk_sha256: hash(apk), bundle_sha256: hash(runtime),
    module_count: map.sources.length, bundled_sample_present: false };
}

export function verifyNativeApkPrivacy(apk, mobileRoot) {
  // Cloud/EAS publication must supply these build outputs too; no receipt-only bypass.
  const bundlePath = process.env.AR_APP_NATIVE_BUNDLE_PATH || join(mobileRoot,
    'android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle');
  const mapPath = process.env.AR_APP_NATIVE_SOURCE_MAP_PATH || join(mobileRoot,
    'android/app/build/generated/sourcemaps/react/release/index.android.bundle.map');
  return verifyApkPayloadPrivacy(apk, readFileSync(bundlePath), JSON.parse(readFileSync(mapPath, 'utf8')));
}
