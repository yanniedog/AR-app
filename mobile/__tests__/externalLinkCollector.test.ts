import {
  collectExternalAuditLinks,
  createExternalAuditLinkCollector,
  FIXED_EXTERNAL_AUDIT_LINKS,
  uniqueExternalAuditLinks,
} from '../src/lib/externalLinkInventory';
import * as policy from '../src/lib/trustedExternalUrl';
import type { DetailsPayload } from '../src/types';

const request = (url: string, label = url): policy.TrustedExternalUrlRequest => ({
  url, label, purpose: 'lender_source',
});
const details = (urls: readonly string[]): DetailsPayload => ({
  schema_version: 1, run_date: '2026-10-12', products: Object.fromEntries(urls.map((url, index) => [
    `product-${index}`, { links: { overview: url } },
  ])),
});

afterEach(() => jest.restoreAllMocks());

it('validates repeated raw destinations once while preserving canonical first-label and rejected-source semantics', () => {
  const first = request('http://bank.com.au./product#first', 'First source');
  const canonical = request('https://bank.com.au/product#second', 'Later source');
  const rejected = request('http://unapproved.test/product', 'Rejected source');
  const differentPurpose = { ...first, purpose: 'app_release' as const };
  const validate = jest.spyOn(policy, 'trustedExternalUrl');
  const result = uniqueExternalAuditLinks([
    ...Array.from({ length: 1_000 }, () => first), canonical,
    ...Array.from({ length: 1_000 }, () => rejected), differentPurpose,
  ]);
  expect(result).toEqual([first, rejected, differentPurpose]);
  expect(validate).toHaveBeenCalledTimes(4);
});

it('matches the complete inventory and reuses policy work without retaining removed sources or old labels', async () => {
  const retained = 'https://bank.com.au/retained';
  const removed = 'https://bank.com.au/removed';
  const rejected = 'http://unapproved.test/product';
  const initial = details([retained, removed, rejected, retained]);
  const changed = details([retained, rejected, 'https://bank.com.au/added']);
  const observed = [request(retained, 'Mounted source takes precedence'), request('https://bank.com.au/mounted')];
  const expectedInitial = collectExternalAuditLinks({ details: initial });
  const expectedChanged = collectExternalAuditLinks({ details: changed, observed });
  const validate = jest.spyOn(policy, 'trustedExternalUrl');
  const collect = createExternalAuditLinkCollector();
  const checkpoint = jest.fn(async () => {});
  expect(await collect({ details: initial }, checkpoint)).toEqual(expectedInitial);
  expect(validate).toHaveBeenCalledTimes(FIXED_EXTERNAL_AUDIT_LINKS.length + 3);
  validate.mockClear();
  const result = await collect({ details: changed, observed }, checkpoint);
  expect(result).toEqual(expectedChanged);
  expect(result.find(entry => entry.url === retained)?.label).toBe('Mounted source takes precedence');
  expect(result.some(entry => entry.url === removed)).toBe(false);
  expect(result.some(entry => entry.url === rejected)).toBe(true);
  expect(validate).toHaveBeenCalledTimes(2);
  expect(checkpoint.mock.calls.length).toBeGreaterThanOrEqual(4);
});

it('yields before parsing and bounds new policy validations and duplicate scans per slice', async () => {
  const collect = createExternalAuditLinkCollector();
  const validate = jest.spyOn(policy, 'trustedExternalUrl');
  let previous = 0;
  let slices = 0;
  const source = details(Array.from({ length: 600 }, (_, index) =>
    `https://bank.com.au/product/${Math.floor(index / 300)}`));
  const result = await collect({ details: source }, async () => {
    expect(validate.mock.calls.length - previous).toBeLessThanOrEqual(16);
    if (slices === 0) expect(validate).not.toHaveBeenCalled();
    previous = validate.mock.calls.length;
    slices++;
  }, () => 0);
  expect(result).toHaveLength(FIXED_EXTERNAL_AUDIT_LINKS.length + 2);
  // Only seven parses are needed, but 605 raw candidates still require slices.
  expect(slices).toBeGreaterThanOrEqual(4);
});

it('checks its time budget between requests even when the count bound has not been reached', async () => {
  const collect = createExternalAuditLinkCollector();
  const validate = jest.spyOn(policy, 'trustedExternalUrl');
  let clock = 0;
  let previous = 0;
  await collect({ details: details(['https://bank.com.au/product']) }, async () => {
    expect(validate.mock.calls.length - previous).toBeLessThanOrEqual(1);
    previous = validate.mock.calls.length;
  }, () => { clock += 4; return clock; });
});

it('stops immediately when a checkpoint rejects, with no late inventory work', async () => {
  const collect = createExternalAuditLinkCollector();
  const validate = jest.spyOn(policy, 'trustedExternalUrl');
  let checkpoints = 0;
  const failure = new Error('Audit cancelled or preparation deadline exceeded');
  await expect(collect({ details: details(Array.from({ length: 100 }, (_, i) => `https://bank.com.au/${i}`)) },
    async () => { if (++checkpoints === 2) throw failure; }, () => 0)).rejects.toBe(failure);
  expect(validate).toHaveBeenCalledTimes(16);
  await Promise.resolve();
  expect(validate).toHaveBeenCalledTimes(16);
});

it('checks the deadline after the final synchronous slice', async () => {
  const collect = createExternalAuditLinkCollector();
  const validate = jest.spyOn(policy, 'trustedExternalUrl');
  const failure = new Error('Late synchronous completion');
  await expect(collect({}, async () => {
    if (validate.mock.calls.length) throw failure;
  }, () => 0)).rejects.toBe(failure);
  expect(validate).toHaveBeenCalledTimes(FIXED_EXTERNAL_AUDIT_LINKS.length);
});
