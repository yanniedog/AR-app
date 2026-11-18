import pair from './fixtures/product-criteria-wire-v2-real-20260519.json';
import { CRITERIA_TREE_LIMITS, decodeCriteriaProducts } from '../src/data/productCriteriaWire';

const decode = (shard: Record<string, unknown>, budget = { nodes: 0 }, checkpoint = async () => undefined) =>
  decodeCriteriaProducts(shard, budget, checkpoint);
const controls = (): Record<string, unknown> => ({ schema_version: 2, ...JSON.parse(JSON.stringify(pair.encoded)) });

test('producer-captured v1 and v2 have exactly identical facts, lexemes, source paths and document references', async () => {
  const a = { nodes: 0 }, b = { nodes: 0 };
  const v1 = await decode({ schema_version: 1, products: pair.products }, a);
  const v2 = await decode(controls(), b);
  expect(v2).toEqual(v1); expect(v2).toEqual(pair.products); expect(b.nodes).toBe(a.nodes);
  expect(Object.getPrototypeOf(v2)).toBeNull();
  expect(Object.getPrototypeOf(Object.values(v2)[0])).toBeNull();
});
test.each(['duplicate-key', 'duplicate-string', 'hostile-key', 'bad-key-index', 'bad-reference', 'noncanonical-reference',
  'malformed-escape', 'long-key', 'oversized-table', 'hostile-route', 'mixed-v1'])(
  'rejects %s instead of adopting a partially expanded product', async fault => {
    const shard: Record<string, unknown> = { schema_version: 2, keyTable: ['facts'], stringTable: ['retained'], products: { control: { '0': [] } } };
    if (fault === 'duplicate-key') shard.keyTable = ['facts', 'facts'];
    if (fault === 'duplicate-string') shard.stringTable = ['retained', 'retained'];
    if (fault === 'hostile-key') shard.keyTable = ['__proto__'];
    if (fault === 'bad-key-index') shard.products = { control: { '00': [] } };
    if (fault === 'bad-reference') shard.products = { control: { '0': '~1' } };
    if (fault === 'noncanonical-reference') shard.products = { control: { '0': '~00' } };
    if (fault === 'malformed-escape') shard.products = { control: { '0': '~' } };
    if (fault === 'long-key') shard.keyTable = ['é'.repeat(129)];
    if (fault === 'oversized-table') shard.stringTable = Array.from({ length: CRITERIA_TREE_LIMITS.strings + 1 }, (_, i) => String(i));
    if (fault === 'hostile-route') shard.products = JSON.parse('{"__proto__":{}}');
    if (fault === 'mixed-v1') shard.schema_version = 1;
    await expect(decode(shard)).rejects.toThrow('compact criteria');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
test('literal tilde escapes and table references are interpreted once without numeric coercion', async () => {
  const shard = { schema_version: 2, keyTable: ['value'], stringTable: ['~0'], products: {
    reference: { '0': '~0' }, escaped: { '0': '~~0' }, exact: { '0': '9007199254740993.000100' },
  } };
  expect(await decode(shard)).toEqual({ reference: { value: '~0' }, escaped: { value: '~0' }, exact: { value: '9007199254740993.000100' } });
});
test('enforces depth, node and catalogue budgets and propagates cancellation checkpoints', async () => {
  let nested: unknown = null; for (let i = 0; i < 65; i++) nested = [nested];
  await expect(decode({ schema_version: 1, products: { control: nested } })).rejects.toThrow();
  await expect(decode({ schema_version: 1, products: { control: new Array(CRITERIA_TREE_LIMITS.nodes).fill(null) } })).rejects.toThrow();
  await expect(decode(controls(), { nodes: CRITERIA_TREE_LIMITS.totalNodes - 1 })).rejects.toThrow();
  const checkpoint = jest.fn(async () => { throw new Error('edition cancelled'); });
  await expect(decode({ schema_version: 1, products: { control: new Array(2048).fill(null) } }, { nodes: 0 }, checkpoint)).rejects.toThrow('edition cancelled');
  expect(checkpoint).toHaveBeenCalledTimes(1);
});
