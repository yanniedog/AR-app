import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { sampleManifest } from '../src/data/sample';
import { catalogueFixture } from '../testUtils/publicRates';
import { getPublicRateCatalogueSnapshot, preparePublicRateCatalogueForAudit, usePublicRateCatalogue,
  type PublicRateCatalogueState } from '../src/data/publicRateCatalogue';
import type { Manifest } from '../src/types';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

test.each([null, { ...sampleManifest }])('actual hook and imperative readers accept a legacy or null manifest', async manifest => {
  const wire = jest.fn(); globalThis.fetch = wire;
  let snapshot: PublicRateCatalogueState | undefined;
  function Probe() { snapshot = usePublicRateCatalogue(manifest); return null; }
  let tree!: ReturnType<typeof TestRenderer.create>;
  await act(async () => { tree = TestRenderer.create(<Probe />); });
  try {
    expect(snapshot).toMatchObject({ status: 'unavailable', allLoaded: false, error: null });
    expect(getPublicRateCatalogueSnapshot(manifest)).toMatchObject({ status: 'unavailable', allLoaded: false });
    if (manifest) {
      const load = preparePublicRateCatalogueForAudit(manifest);
      expect(await load.ready).toMatchObject({ status: 'unavailable', allLoaded: false });
      await load.cancelAndDrain(); load.quiesce(); load.release();
    }
    expect(wire).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});

test.each(['invalid-shape', 'undefined-field', 'cyclic'] as const)('malformed %s catalogue capabilities fail closed in the real hook without throwing', async shape => {
  const base = catalogueFixture().manifest;
  const value: Record<string, unknown> = shape === 'invalid-shape' ? {} : { ...base.public_rate_catalogue, index: undefined };
  if (shape === 'cyclic') value.loop = value;
  const manifest = { ...base, public_rate_catalogue: value } as unknown as Manifest;
  const wire = jest.fn(); globalThis.fetch = wire;
  let snapshot: PublicRateCatalogueState | undefined;
  function Probe() { snapshot = usePublicRateCatalogue(manifest); return null; }
  let tree!: ReturnType<typeof TestRenderer.create>;
  await act(async () => { tree = TestRenderer.create(<Probe />); });
  try {
    expect(snapshot).toMatchObject({ status: 'error', allLoaded: false });
    expect(snapshot!.error).toBeTruthy();
    expect(getPublicRateCatalogueSnapshot(manifest)).toBe(snapshot);
    await act(async () => { tree.update(<Probe />); });
    expect(getPublicRateCatalogueSnapshot(manifest)).toBe(snapshot);
    expect(wire).not.toHaveBeenCalled();
  } finally { act(() => tree.unmount()); }
});
