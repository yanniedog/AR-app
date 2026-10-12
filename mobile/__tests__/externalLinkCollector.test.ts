import {
  collectExternalAuditLinks,
  createExternalAuditLinkCollector,
  FIXED_EXTERNAL_AUDIT_LINKS,
  iterateExternalAuditLinks,
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

it('keeps public iterator entries independent for passive consumers that retain requests', () => {
  const source = details(['https://bank.com.au/first', 'https://bank.com.au/second']);
  source.products['product-1'].sourceDocuments = [{ url: 'https://bank.com.au/terms', sourcePath: 'terms', relation: 'terms', label: 'Terms' }];
  const iterator = iterateExternalAuditLinks({ details: source });
  const retained: policy.TrustedExternalUrlRequest[] = [];
  for (const value of iterator) retained.push(value);
  const catalogue = retained.slice(FIXED_EXTERNAL_AUDIT_LINKS.length);
  expect(catalogue.map(entry => entry.url)).toEqual([
    'https://bank.com.au/first', 'https://bank.com.au/second', 'https://bank.com.au/terms',
  ]);
  expect(new Set(catalogue).size).toBe(3);
});

it('preserves purpose separation and the full source order while reusing private request storage', async () => {
  const source = details(['https://bank.com.au/product']);
  const observed = [request('https://bank.com.au/product', 'Mounted lender'),
    { ...request('https://bank.com.au/product', 'Rejected app source'), purpose: 'app_release' as const }];
  const input = { details: source, observed,
    economicOutlook: { indicators: [{ sourceUrl: 'https://www.abs.gov.au/statistics/', label: 'Inflation' }] } as NonNullable<Parameters<typeof collectExternalAuditLinks>[0]>['economicOutlook'],
    releaseNotes: [{ version: '1.0.227', releaseUrl: 'https://github.com/yanniedog/AR-app/releases/tag/v1.0.227' }] };
  const collect = createExternalAuditLinkCollector();
  const expected = collectExternalAuditLinks(input);
  expect(await collect(input, async () => {})).toEqual(expected);
  expect(await collect(input, async () => {})).toEqual(expected);
  expect(expected.filter(entry => entry.url === observed[0].url)).toEqual(observed);
});

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
  let scanned = 0;
  const source = details(Array.from({ length: 10_000 }, (_, index) =>
    `https://bank.com.au/product/${Math.floor(index / 5_000)}`));
  const result = await collect({ details: source }, async (_count, progress) => {
    expect(validate.mock.calls.length - previous).toBeLessThanOrEqual(16);
    expect(progress.scannedCandidates - scanned).toBeLessThanOrEqual(4_096);
    if (slices === 0) expect(validate).not.toHaveBeenCalled();
    previous = validate.mock.calls.length;
    scanned = progress.scannedCandidates;
    slices++;
  }, () => 0);
  expect(result).toHaveLength(FIXED_EXTERNAL_AUDIT_LINKS.length + 2);
  // Only seven parses are needed; cheap duplicates still have a finite count cap.
  expect(slices).toBeGreaterThanOrEqual(4);
  expect(scanned).toBe(10_005);
});

it('finishes a cached large-catalogue pass within 10 seconds despite native yield overhead', async () => {
  const source = details(Array.from({ length: 53_771 }, (_, index) =>
    `https://bank.com.au/product/${index % 2_348}`));
  const collect = createExternalAuditLinkCollector();
  const initial = await collect({ details: source }, async () => {}, () => 0);
  const validate = jest.spyOn(policy, 'trustedExternalUrl');
  let elapsed = 0;
  let checkpointCount = 0;
  const repeated = await collect({ details: source }, async (_count, progress) => {
    // Model rendering/scheduling delays independently of policy CPU. The
    // previous 256-item cap requires over 200 such native yields.
    elapsed += 180;
    checkpointCount++;
    expect(elapsed).toBeLessThan(10_000);
    expect(progress.policyValidations).toBe(0);
    expect(progress.activeCpuMs).toBe(0);
    expect(progress.maxSliceMs).toBe(0);
  }, () => elapsed);
  expect(repeated).toEqual(initial);
  expect(validate).not.toHaveBeenCalled();
  expect(checkpointCount).toBe(15);
  expect(elapsed).toBe(2_700);
});

it('observes additions, removals, URL changes and labels mutated inside the same details object', async () => {
  const source = details(['https://bank.com.au/old', 'https://bank.com.au/removed']);
  source.products['product-0'].sourceDocuments = [{ url: 'https://bank.com.au/document', sourcePath: 'documents.0', relation: 'terms', label: 'Old label' }];
  const collect = createExternalAuditLinkCollector();
  await collect({ details: source, observed: [
    request('https://bank.com.au/old', 'Old mounted label'),
    request('https://bank.com.au/previously-mounted', 'Unmounted source'),
  ] }, async () => {});
  source.products['product-0'].links!.overview = 'https://bank.com.au/new';
  source.products['product-0'].sourceDocuments![0].label = 'Updated label';
  source.products['product-0'].sourceDocuments!.push({ url: 'http://unapproved.test/rejected', sourcePath: 'documents.1', relation: 'terms', label: 'New rejected document' });
  delete source.products['product-1'];
  const observed = [request('https://bank.com.au/new', 'Mounted label'),
    request('https://bank.com.au/newly-mounted', 'New mounted source')];
  const expected = collectExternalAuditLinks({ details: source, observed });
  const actual = await collect({ details: source, observed }, async () => {});
  expect(actual).toEqual(expected);
  expect(actual.find(entry => entry.url.endsWith('/new'))?.label).toBe('Mounted label');
  expect(actual.find(entry => entry.url.endsWith('/document'))?.label).toBe('Updated label');
  expect(actual.some(entry => entry.url.endsWith('/previously-mounted'))).toBe(false);
  expect(actual.find(entry => entry.url.endsWith('/newly-mounted'))?.label).toBe('New mounted source');
  expect(actual.some(entry => /old|removed/.test(entry.url))).toBe(false);
  expect(actual.some(entry => entry.url === 'http://unapproved.test/rejected')).toBe(true);
});

it('amortizes native clock calls for cached references while still bounding their CPU slices', async () => {
  const source = details(Array.from({ length: 12_000 }, (_, index) =>
    `https://bank.com.au/product/${index % 20}`));
  const collect = createExternalAuditLinkCollector();
  const expected = await collect({ details: source }, async () => {}, () => 0);
  let clockCalls = 0;
  let elapsed = 0;
  let previousScanned = 0;
  const actual = await collect({ details: source }, async (_count, progress) => {
    expect(progress.scannedCandidates - previousScanned).toBeLessThanOrEqual(4_096);
    expect(progress.maxSliceMs).toBeLessThan(9);
    expect(progress.policyValidations).toBe(0);
    previousScanned = progress.scannedCandidates;
  }, () => { clockCalls++; elapsed += 0.05; return elapsed; });
  expect(actual).toEqual(expected);
  // This models a nonzero host-clock cost and catches a return to reading the
  // native clock once per duplicated reference in a large published catalogue.
  expect(clockCalls).toBeLessThan(1_000);
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
