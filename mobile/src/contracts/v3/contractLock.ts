/** Exact AR-local origin/main contract set vendored for the dormant v3 reader. */
export const V3_CONTRACT_SCHEMA_FILES = Object.freeze([
  'asset-descriptor-v3.schema.json',
  'canonical-core-v3.schema.json',
  'coverage-v2.schema.json',
  'generation-manifest-v3.schema.json',
  'generation-pointer-v3.schema.json',
] as const);

export const V3_CONTRACT_SCHEMA_SET_SHA256 =
  '94ac90e09f1a86c894ac8168bd5d44f8eb50675a37435b3a05f1b8f14d690964';

/** Byte hashes make accidental formatting drift visible before schema-set parsing. */
export const V3_CONTRACT_SCHEMA_SHA256 = Object.freeze({
  'asset-descriptor-v3.schema.json': '1f7ffa9e423d3367e984a9cfa24258632e59b32306874c673d63344c613cbf55',
  'canonical-core-v3.schema.json': '581dcdc7748e3586eb53dfe3364b4ab672a17cf706cf7be5f723e9affad85476',
  'coverage-v2.schema.json': 'e4befbbd84035c0ddf12775ebd16f81dc0281185d001c18f04d857b4a00b35b5',
  'generation-manifest-v3.schema.json': '07f3d462b983b7bd07c917ecb5c7f2393eb6be23232d0474b0be7d33d14938b9',
  'generation-pointer-v3.schema.json': '2e231510228cb3c90d4eadc60884a8f4cc79e018e910c901d5a1318181a5e921',
});
