import { ratesResultRowKey } from '../src/data/ratesResultRowKey';

test('distinct legal product/offer pairs never alias through identifier delimiters', () => {
  const identifiers = ['UNIT', 'UNIT-A', 'A-B', 'B', '0', 'a:b', 'a#b', '["rate"]', '"', '\\'];
  const keys = identifiers.flatMap(product_key => identifiers.map(public_offer_id =>
    ratesResultRowKey({ product_key, public_offer_id }, 0)));
  expect(new Set(keys).size).toBe(identifiers.length ** 2);
  expect(ratesResultRowKey({ product_key: 'UNIT-A', public_offer_id: 'B' }, 0))
    .not.toBe(ratesResultRowKey({ product_key: 'UNIT', public_offer_id: 'A-B' }, 1));
});

test('semantic offers, legacy rate indexes and details-only identities use separate namespaces', () => {
  const semantic = ratesResultRowKey({ product_key: 'UNIT', public_offer_id: '0', rate_index: 0 }, 0);
  const legacy = ratesResultRowKey({ product_key: 'UNIT', rate_index: 0 }, 0);
  const unlisted = ratesResultRowKey({ key: semantic }, 0);
  expect(new Set([semantic, legacy, unlisted]).size).toBe(3);
});

test('a semantic offer retains its key after source occurrence or page position changes', () => {
  expect(ratesResultRowKey({ product_key: 'UNIT', public_offer_id: 'A-B', rate_index: 2 }, 0))
    .toBe(ratesResultRowKey({ product_key: 'UNIT', public_offer_id: 'A-B', rate_index: 42 }, 20));
});

test('legacy fallback uses the absolute row position while explicit indexes stay stable', () => {
  expect(ratesResultRowKey({ product_key: 'UNIT' }, 0)).not.toBe(ratesResultRowKey({ product_key: 'UNIT' }, 20));
  expect(ratesResultRowKey({ product_key: 'UNIT', rate_index: 3 }, 0))
    .toBe(ratesResultRowKey({ product_key: 'UNIT', rate_index: 3 }, 20));
});
