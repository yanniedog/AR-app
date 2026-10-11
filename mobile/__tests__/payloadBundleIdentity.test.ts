import historyManifest from './fixtures/detached-history-manifest-20260926.json';
import type { Manifest } from '../src/types';
import { payloadBundleIdentity } from '../src/data/payloadBundleIdentity';
import { canonical, hashText } from '../src/lib/productTermsEngine/validation';
import { eligibilityTransportHarness } from '../test-support/eligibilityHarness';
import { savingsHarness } from '../test-support/savingsMonetaryHarness';
import { activityHarness } from '../test-support/activityHarness';
import { mortgageHarness } from '../test-support/mortgageHarness';
import { downloadInflate } from '../src/data/payload';

jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
beforeEach(() => (downloadInflate as jest.Mock).mockReset());

// Independent Python hashlib/json vectors over the existing real manifest's
// canonical preimage. Malformed history remains verbatim; producer publication
// rejects it, but it must not crash other independently validated capabilities.
const malformed: { label: string; namespace: unknown; expected: string }[] = [
  { label: 'missing file', namespace: { schema_version: 1 }, expected: '97a33d4dd86d3d4e522cce3d416ea24f714402e4ef156569123805bbcf2534c7' },
  { label: 'null file', namespace: { schema_version: 1, file: null }, expected: '2f74caf1940b4ddac86547072434e1100e4cc12d7a91216f3b6db735053f7c08' },
  { label: 'array file', namespace: { schema_version: 1, file: ['url'] }, expected: 'e15467ad63fdbf8aef57736ce24377720277d4c2bfb1578b747b3cede22e1282' },
  { label: 'string file', namespace: { schema_version: 1, file: 'route' }, expected: 'df197e9afa9f2e20a4dfac478ab80cdea6087362870fcbbb37a9401e781c15f0' },
  { label: 'boolean file', namespace: { schema_version: 1, file: false }, expected: 'dd3e9fa4ca9c06438cd9ba56b22fc357411b53bec2d7a791310cc5b75c472b28' },
  { label: 'number file', namespace: { schema_version: 1, file: 42 }, expected: '0776699630db3c92ccb18f05f203b89bf9cd463dc8104c3b1d0007a862c93a66' },
  { label: 'empty namespace', namespace: {}, expected: '5be9243d3388312eaf5b7cf5a71ae2c5c2372a460a6498157be303e31eef7730' },
  { label: 'null namespace', namespace: null, expected: '860826dd69b1c6f59db8d6b5f02adb85018c807661b5ff562987bd6610547ff1' },
  { label: 'array namespace', namespace: ['history'], expected: 'f692662b0554d50f17cf9dcd30cccbe8d1283aa47260f53c4ed7f257ca3be534' },
  { label: 'string namespace', namespace: 'history', expected: '945749af1bc25e60f1ce0173c5d61f95c01bdf393fc886f84ecd9d8b7482c4de' },
  { label: 'boolean namespace', namespace: true, expected: 'f8cdbf014be1723ab8c47e5305bf1e82968da33e7261fd44f8f027867e3704f8' },
  { label: 'zero namespace', namespace: 0, expected: '4cf6f1a8888b82aece65b177dcaf7a5b4b3e511bf599b2335f5ee587e751d8f3' },
];

test.each(malformed)('binds raw $label without coercion, omission or mutation', ({ namespace, expected }) => {
  const manifest = Object.assign(structuredClone(historyManifest), { bank_rate_history_catalogue: namespace }) as Manifest;
  const before = JSON.stringify(manifest);
  expect(payloadBundleIdentity(manifest)).toBe(expected);
  expect(JSON.stringify(manifest)).toBe(before);
});

// Independent raw preimage for malformed metadata: do not use the tested helper
// to mint the revision that capability loaders subsequently verify.
function rawBundle(manifest: Manifest) {
  const value = Object.fromEntries(Object.entries(manifest).filter(([key]) => !['generated_at', 'tag', 'payload_revision', 'files'].includes(key)));
  value.files = Object.fromEntries(Object.entries(manifest.files).map(([key, file]) =>
    [key, Object.fromEntries(Object.entries(file).filter(([field]) => field !== 'url'))]));
  return hashText(canonical(value));
}

const capabilities = [
  { name: 'eligibility', create: () => eligibilityTransportHarness() },
  { name: 'monetary savings', create: () => savingsHarness() },
  { name: 'savings activity', create: () => activityHarness() },
  { name: 'mortgage', create: () => mortgageHarness() },
];
describe.each(capabilities)('$name publication identity', ({ create }) => {
  test.each(malformed.slice(0, 2))('remains independently verified with $label history', async ({ namespace }) => {
    const h = await create(), manifest = h.context.manifest;
    Object.assign(manifest, { bank_rate_history_catalogue: namespace });
    const bundle = rawBundle(manifest);
    Object.assign(manifest.payload_revision!, { bundle_sha256: bundle, generation_id: `sha256-${bundle}` });
    (downloadInflate as jest.Mock).mockClear();
    expect(await h.load()).toHaveLength(1);
    expect(downloadInflate).toHaveBeenCalledTimes(2);
    expect((downloadInflate as jest.Mock).mock.calls.every(([url]) => !String(url).includes('bank-rate-history'))).toBe(true);

    Object.assign(manifest, { bank_rate_history_catalogue: { schema_version: 1, file: 'changed' } });
    (downloadInflate as jest.Mock).mockClear();
    await expect(h.load()).rejects.toThrow(/identity|revision/i);
    expect(downloadInflate).not.toHaveBeenCalled();
  });
});
