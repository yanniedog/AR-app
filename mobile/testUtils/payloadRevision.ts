import { sampleManifest } from '../src/data/sample';
import { revisionTag, type PayloadRevisionHead } from '../src/data/payloadRevision';
import type { Manifest } from '../src/types';

/** Protocol metadata around the checked-in captured payload; no invented rate data. */
export function revisionManifest(revision: number, overrides: Partial<Manifest> = {}): Manifest {
  const tag = revisionTag(sampleManifest.run_date, revision);
  return { ...sampleManifest, ...overrides, tag,
    payload_revision: { schema_version: 1, revision, generation_id: `observation-${revision}`,
      bundle_sha256: String(revision).padStart(64, '0'), parent_revision: revision === 1 ? null : revision - 1 },
    files: Object.fromEntries(Object.entries(overrides.files ?? sampleManifest.files).map(([key, file]) => [key, {
      ...file, url: `https://github.com/${sampleManifest.repo}/releases/download/${tag}/${file.name}`,
    }])) as Manifest['files'],
  };
}

export function revisionHead(manifest: Manifest): PayloadRevisionHead {
  return { revision: manifest.payload_revision!.revision, generation_id: manifest.payload_revision!.generation_id,
    bundle_sha256: manifest.payload_revision!.bundle_sha256, manifest_sha256: 'a'.repeat(64),
    manifest_url: `https://github.com/${manifest.repo}/releases/download/${manifest.tag}/manifest.json` };
}
