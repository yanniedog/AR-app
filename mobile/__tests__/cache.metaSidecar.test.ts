import * as FileSystem from 'expo-file-system/legacy';

import { cache, type CacheMeta } from '../src/data/cache';
import { sampleCore, sampleManifest } from '../src/data/sample';

const files = new Map<string, string>();

function resetFs() {
  files.clear();
  (FileSystem.getInfoAsync as jest.Mock).mockImplementation(async (path: string) => ({
    exists: files.has(path) || path.endsWith('payload/'),
    isDirectory: path.endsWith('payload/'),
  }));
  (FileSystem.readAsStringAsync as jest.Mock).mockImplementation(async (path: string) => {
    if (!files.has(path)) throw new Error(`missing ${path}`);
    return files.get(path)!;
  });
  (FileSystem.writeAsStringAsync as jest.Mock).mockImplementation(async (path: string, contents: string) => {
    files.set(path, contents);
  });
  (FileSystem.deleteAsync as jest.Mock).mockImplementation(async (path: string) => {
    files.delete(path);
  });
  (FileSystem.moveAsync as jest.Mock).mockImplementation(async ({ from, to }: { from: string; to: string }) => {
    const value = files.get(from);
    if (value === undefined) throw new Error(`missing ${from}`);
    files.set(to, value);
    files.delete(from);
  });
  (FileSystem.makeDirectoryAsync as jest.Mock).mockResolvedValue(undefined);
}

describe('cache core-meta sidecar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetFs();
  });

  it('writeBundle stores a tiny core-meta sidecar and updateMeta never rewrites the bundle', async () => {
    const meta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-14T00:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: null,
    };
    const coreText = JSON.stringify(sampleCore);
    await cache.writeBundle(meta, coreText);

    const metaPath = `${FileSystem.documentDirectory}payload/core-meta.json`;
    const bundlePath = `${FileSystem.documentDirectory}payload/core-bundle.json`;
    expect(files.has(metaPath)).toBe(true);
    expect(files.has(bundlePath)).toBe(true);
    const bundleBefore = files.get(bundlePath)!;

    await cache.updateMeta({
      manifest: sampleManifest,
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: sampleManifest.files.details.sha256,
      savedAt: '2026-07-14T01:00:00Z',
      source: 'remote',
    });

    expect(files.get(bundlePath)).toBe(bundleBefore);
    const read = await cache.readMeta();
    expect(read?.detailsSha).toBe(sampleManifest.files.details.sha256);
    // Sidecar stays tiny relative to embedding a multi-MB core rewrite.
    expect(files.get(metaPath)!.length).toBeLessThan(bundleBefore.length);
  });

  it('readMeta falls back to embedded bundle meta when sidecar is missing', async () => {
    const meta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-14T00:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: 'embedded-details-sha',
    };
    const bundlePath = `${FileSystem.documentDirectory}payload/core-bundle.json`;
    files.set(bundlePath, JSON.stringify({ meta, core: sampleCore }));

    const read = await cache.readMeta();
    expect(read?.detailsSha).toBe('embedded-details-sha');
    expect(read?.coreSha).toBe(sampleManifest.files.core.sha256);
  });

  it('writeBundle invalidates a prior sidecar before committing the new bundle', async () => {
    const metaPath = `${FileSystem.documentDirectory}payload/core-meta.json`;
    const bundlePath = `${FileSystem.documentDirectory}payload/core-bundle.json`;
    const oldMeta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-13T00:00:00Z',
      coreSha: 'old-core-sha',
      detailsSha: 'old-details-sha',
    };
    files.set(metaPath, JSON.stringify(oldMeta));
    files.set(bundlePath, JSON.stringify({ meta: oldMeta, core: sampleCore }));

    const newMeta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-14T00:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: null,
    };
    await cache.writeBundle(newMeta, JSON.stringify(sampleCore));

    const read = await cache.readMeta();
    expect(read?.coreSha).toBe(sampleManifest.files.core.sha256);
    expect(read?.detailsSha).toBeNull();
    expect(JSON.parse(files.get(metaPath)!).coreSha).toBe(sampleManifest.files.core.sha256);
  });

  it('readMeta falls back to tmp bundle when the main bundle is missing', async () => {
    const meta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-14T00:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: 'tmp-details-sha',
    };
    const tmpPath = `${FileSystem.documentDirectory}payload/core-bundle.json.tmp`;
    files.set(tmpPath, JSON.stringify({ meta, core: sampleCore }));

    const read = await cache.readMeta();
    expect(read?.detailsSha).toBe('tmp-details-sha');
    expect(read?.coreSha).toBe(sampleManifest.files.core.sha256);
  });

  it('readBundle prefers a matching sidecar and ignores a mismatched coreSha sidecar', async () => {
    const meta: CacheMeta = {
      manifest: sampleManifest,
      source: 'remote',
      savedAt: '2026-07-14T00:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: null,
    };
    await cache.writeBundle(meta, JSON.stringify(sampleCore));

    const sidecarMeta: CacheMeta = {
      ...meta,
      detailsSha: 'sidecar-details-sha-1234',
      savedAt: '2026-07-14T01:00:00Z',
    };
    await cache.updateMeta(sidecarMeta);
    const withSidecar = await cache.readBundle();
    expect(withSidecar?.meta.detailsSha).toBe('sidecar-details-sha-1234');

    const metaPath = `${FileSystem.documentDirectory}payload/core-meta.json`;
    // updateMeta no-ops on coreSha mismatch, so plant a stale sidecar directly.
    files.set(
      metaPath,
      JSON.stringify({
        ...sidecarMeta,
        coreSha: 'stale-core-sha-5678',
      }),
    );
    const withStale = await cache.readBundle();
    expect(withStale?.meta.detailsSha).toBeNull();
    expect(withStale?.meta.coreSha).toBe(sampleManifest.files.core.sha256);
  });

  it('updateMeta no-ops on coreSha mismatch and older manifests', async () => {
    const meta: CacheMeta = {
      manifest: { ...sampleManifest, generated_at: '2026-07-14T12:00:00Z' },
      source: 'remote',
      savedAt: '2026-07-14T12:00:00Z',
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: 'keep-me',
    };
    await cache.writeBundle(meta, JSON.stringify(sampleCore));
    const metaPath = `${FileSystem.documentDirectory}payload/core-meta.json`;
    const before = files.get(metaPath)!;

    await cache.updateMeta({
      manifest: sampleManifest,
      coreSha: 'other-core-sha',
      detailsSha: 'should-not-apply',
      savedAt: '2026-07-14T13:00:00Z',
      source: 'remote',
    });
    expect(files.get(metaPath)).toBe(before);

    await cache.updateMeta({
      manifest: { ...sampleManifest, generated_at: '2026-07-13T00:00:00Z' },
      coreSha: sampleManifest.files.core.sha256,
      detailsSha: 'older-should-not-apply',
      savedAt: '2026-07-14T13:00:00Z',
      source: 'remote',
    });
    expect(files.get(metaPath)).toBe(before);
    expect((await cache.readMeta())?.detailsSha).toBe('keep-me');
  });
});
