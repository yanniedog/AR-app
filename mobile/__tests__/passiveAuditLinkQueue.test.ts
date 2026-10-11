import type { DetailsPayload } from '../src/types';
import { collectExternalAuditLinks } from '../src/lib/externalLinkInventory';
import { advancePassiveLinkQueue, createPassiveLinkQueue } from '../src/lib/passiveAuditLinkQueue';
import * as policy from '../src/lib/trustedExternalUrl';

it('bounds URL parsing, skips cheap duplicate candidates and preserves canonical foreground inventory', () => {
  const details: DetailsPayload = { schema_version: 1, run_date: '2026-10-12', products: {
    repeated: { sourceDocuments: Array.from({ length: 300 }, () => ({ url: 'https://bank.com.au/shared', sourcePath: '', relation: '' })) },
    legacy: { links: { overview: 'http://bank.com.au./shared#section' } },
    ...Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`p-${i}`, { links: { overview: `https://bank.com.au/${i}` } }])),
  } };
  const expected = collectExternalAuditLinks({ details }).filter(request => policy.trustedExternalUrl(request).ok);
  const validator = jest.spyOn(policy, 'trustedExternalUrl');
  const queue = createPassiveLinkQueue(details);
  try {
    advancePassiveLinkQueue(queue, () => false, () => 0);
    expect(validator).toHaveBeenCalledTimes(6); // fixed links plus one repeated lender URL
    expect(queue.done).toBe(false); // raw iteration is capped even for cheap duplicates
    for (let slices = 0; !queue.done && slices < 20; slices++) {
      validator.mockClear();
      advancePassiveLinkQueue(queue, () => false, () => 0);
      expect(validator.mock.calls.length).toBeLessThanOrEqual(16);
    }
    expect(queue.done).toBe(true);
    expect(queue.pending).toEqual(expected);
  } finally { validator.mockRestore(); }
});

it('honours the preparation deadline and cancellation before advancing source input', () => {
  const queue = createPassiveLinkQueue({ schema_version: 1, run_date: '2026-10-12', products: {} });
  advancePassiveLinkQueue(queue, () => true, () => 0);
  expect(queue.pending).toEqual([]);
  let time = 0;
  advancePassiveLinkQueue(queue, () => false, () => (time += 20));
  expect(queue.pending).toEqual([]);
  advancePassiveLinkQueue(queue, () => false, () => 0);
  expect(queue.pending).toHaveLength(5);
  expect(queue.done).toBe(true);
});
