import { type CustomerProfile, type InputDefinition, validFact } from './customerProfile';

/** Only documented legacy fields receive units; all other original data stays intact. */
const LEGACY_FIELDS: [string, string, string][] = [
  ['savings.balance', 'Savings balance', 'AUD'], ['savings.currentRate', 'Savings rate', 'percent'],
  ['termDeposit.balance', 'Term deposit balance', 'AUD'], ['termDeposit.currentRate', 'Term deposit rate', 'percent'],
  ['mortgage.currentRate', 'Mortgage rate', 'percent'], ['mortgage.propertyValue', 'Property value', 'AUD'],
  ['mortgage.loanBalance', 'Mortgage balance', 'AUD'],
];
function lookup(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((obj, key) => obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key)
    ? (obj as Record<string, unknown>)[key] : undefined, value);
}
export function migrateCustomerProfile(legacy: unknown): CustomerProfile {
  if (legacy != null && (typeof legacy !== 'object' || Array.isArray(legacy))) throw new Error('Invalid legacy scenario; retained unchanged.');
  const version = legacy == null ? undefined : (legacy as { version?: unknown }).version;
  if (version !== undefined && ![1, 2, 3].includes(version as number)) throw new Error('Unsupported legacy scenario version; retained unchanged.');
  const p: CustomerProfile = { version: 1, revision: 0, answers: {}, definitions: {}, negotiatedTerms: [], legacyScenario: legacy ?? null };
  const provenance = { source: 'legacy_user_input' as const, recordedAt: null, productKey: null, effectiveFrom: null, effectiveToExclusive: null };
  for (const [path, label, unit] of LEGACY_FIELDS) {
    const value = lookup(legacy, path);
    if (typeof value !== 'string' || !value.trim()) continue;
    const id = `legacy.${path}`, fact = { type: 'decimal' as const, value, unit };
    p.definitions[id] = { id, label, type: 'decimal', unit };
    p.answers[id] = validFact(fact) ? { state: 'known', fact, provenance } : { state: 'unknown', provenance };
  }
  // v3 false/true may be defaults. Never claim the user deliberately confirmed them.
  for (const section of ['savings', 'termDeposit', 'mortgage']) {
    for (const field of ['bonusConditionsMet', 'reinvestInterest']) {
      if (lookup(legacy, `projections.${section}.${field}`) === undefined) continue;
      const id = `legacy.projections.${section}.${field}`;
      const d: InputDefinition = { id, label: `${section}: ${field === 'bonusConditionsMet' ? 'bonus qualification' : 'reinvest interest'}`, type: 'boolean' };
      p.definitions[id] = d; p.answers[id] = { state: 'unknown', provenance };
    }
  }
  return p;
}
