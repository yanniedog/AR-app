/**
 * Byte-level lock for the vendored producer contract. Producer and consumer CI
 * must agree on these digests before the dormant bridge can be activated.
 */
export const V3_CONTRACT_SCHEMA_SHA256 = Object.freeze({
  'core-v3.schema.json': '960bcf4f4828cd741efc0e287159227584e08c010c714785d143753a9d40b60c',
  'generation-manifest-v3.schema.json': 'c5c7980412a057ae214e2009354defdea635b9aab3ced544e513fa861054313f',
  'manifest-v3.schema.json': 'ee08a632ed450ec38da5f23c75148d0568f6a86a99c77c12cff58045f81fe0e4',
} as const);

export const V3_CONTRACT_SHA_LOCK = [
  V3_CONTRACT_SCHEMA_SHA256['core-v3.schema.json'],
  V3_CONTRACT_SCHEMA_SHA256['generation-manifest-v3.schema.json'],
  V3_CONTRACT_SCHEMA_SHA256['manifest-v3.schema.json'],
].join(':');
