/**
 * Byte-level lock for the vendored producer contract. Producer and consumer CI
 * must agree on these digests before the dormant bridge can be activated.
 */
export const V3_CONTRACT_SCHEMA_SHA256 = Object.freeze({
  'core-v3.schema.json': '85880619ec4b9b519484d0f03ff830d25534acce6079f24242c5751a3dc928a5',
  'generation-manifest-v3.schema.json': 'b0eaa94ed4e7121c3a77b81698f79ebea11a0a699621d1549d787a5d8a368321',
  'manifest-v3.schema.json': 'ee08a632ed450ec38da5f23c75148d0568f6a86a99c77c12cff58045f81fe0e4',
} as const);

export const V3_CONTRACT_SHA_LOCK = [
  V3_CONTRACT_SCHEMA_SHA256['core-v3.schema.json'],
  V3_CONTRACT_SCHEMA_SHA256['generation-manifest-v3.schema.json'],
  V3_CONTRACT_SCHEMA_SHA256['manifest-v3.schema.json'],
].join(':');
