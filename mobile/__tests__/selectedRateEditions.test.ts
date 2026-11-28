import { createHash } from 'node:crypto';
import type { CorePayload, DetailsPayload, Manifest } from '../src/types';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { bindVerifiedDetails } from '../src/data/detailsIdentity';
import { selectedRateChange } from '../src/data/selectedRateChange';
import { productRateChangeText } from '../src/components/product/ProductRateChangeLine';

// Product extracts from the two immutable releases identified in each manifest.
// Use the extracts' own hashes when binding them in the test.
function edition(data: { core: CorePayload; details: DetailsPayload; manifest: Manifest }) {
  const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const { files } = data.manifest;
  const manifest = { ...data.manifest, files: { ...files,
    core: { ...files.core, sha256: digest(data.core) }, details: { ...files.details, sha256: digest(data.details) } } };
  const { core, integrity } = normalizeCoreWithIntegrity(data.core, { coreSha256: manifest.files.core.sha256 });
  return { core, coreIntegrity: integrity, manifest, details: bindVerifiedDetails(data.details, manifest.files.details.sha256) };
}

it('withholds the ANZ cross-tier badge and retains the BCU six-month monthly increase', () => {
  const before = edition(require('../test-support/selected-rate/27.json'));
  const after = edition(require('../test-support/selected-rate/28.json'));
  const rows = after.core.sections.TD.rates;
  const anz = rows.find(row => row.provider === 'ANZ' && row.rate_index === 13)!;
  expect([anz.term, anz.interest_payment, anz.rate]).toEqual(['P2M', 'monthly', '0.0175']);
  expect(productRateChangeText(selectedRateChange(before, after, anz, 'TD', 'rate'))).toBeNull();
  const bcu = rows.find(row => row.provider === 'BCU Bank')!;
  const change = selectedRateChange(before, after, bcu, 'TD', 'rate');
  expect(change).toMatchObject({ kind: 'changed', fromRate: 0.053, toRate: 0.0545, bps: 15 });
  expect(productRateChangeText(change)).toContain('5.30% → 5.45%');
});
