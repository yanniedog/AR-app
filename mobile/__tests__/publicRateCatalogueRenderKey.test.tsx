import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { hashText } from '../src/lib/productTermsEngine/validation';
import { catalogueFixture } from '../testUtils/publicRates';
import { beginPublicRateCatalogueAudit, getPublicRateCatalogueSnapshot, usePublicRateCatalogue,
  type PublicRateCatalogueState } from '../src/data/publicRateCatalogue';
import type { Manifest } from '../src/types';

jest.mock('../src/lib/productTermsEngine/validation', () => ({
  ...jest.requireActual('../src/lib/productTermsEngine/validation'),
  hashText: jest.fn(jest.requireActual('../src/lib/productTermsEngine/validation').hashText),
}));

test('row rerenders reuse their edition key while replacement and imperative reads revalidate it', async () => {
  const manifest = catalogueFixture().manifest;
  const lease = beginPublicRateCatalogueAudit();
  let snapshot: PublicRateCatalogueState | undefined;
  function Probe({ edition }: { edition: Manifest }) { snapshot = usePublicRateCatalogue(edition); return null; }
  let tree!: ReturnType<typeof TestRenderer.create>;
  try {
    await act(async () => { tree = TestRenderer.create(<Probe edition={manifest} />); });
    const original = snapshot;
    jest.mocked(hashText).mockClear();
    for (let i = 0; i < 100; i++) act(() => tree.update(<Probe edition={manifest} />));
    expect(hashText).not.toHaveBeenCalled();
    expect(snapshot).toBe(original);

    const replacement = { ...manifest, public_rate_catalogue: { ...manifest.public_rate_catalogue!,
      index: { ...manifest.public_rate_catalogue!.index, sha256: 'f'.repeat(64) } } };
    await act(async () => { tree.update(<Probe edition={replacement} />); });
    expect(hashText).toHaveBeenCalled();
    expect(snapshot).not.toBe(original);

    // The imperative audit path must notice even an in-place capability change.
    const before = getPublicRateCatalogueSnapshot(replacement);
    replacement.public_rate_catalogue.index.sha256 = 'e'.repeat(64);
    jest.mocked(hashText).mockClear();
    expect(getPublicRateCatalogueSnapshot(replacement)).not.toBe(before);
    expect(hashText).toHaveBeenCalled();
  } finally {
    if (tree) act(() => tree.unmount());
    lease.release();
  }
});
