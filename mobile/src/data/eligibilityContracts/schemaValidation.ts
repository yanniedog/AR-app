import { eligibilitySchemas as schemas } from '../monetaryContracts/runtimeSchemas';
import { assertSchemaValid, type Schema } from '../monetaryContracts/schemaValidation';

const external: Record<string, Schema> = {
  'executable-subject-v2.schema.json': schemas.subject,
  'executable-asset-v2.schema.json': schemas.asset,
};

function resolveEligibilityRef(ref: string, document: Schema): { target: Schema; root: Schema } | null {
  if (Object.hasOwn(external, ref)) return { target: external[ref], root: external[ref] };
  if (!ref.startsWith('#/')) return null;
  const target = ref.slice(2).split('/').reduce((o: Schema, key: string) => o?.[key], document);
  return target ? { target, root: document } : null;
}

/** Closed interpreter for checked-in frozen schemas only. No remote schema adoption. */
export function assertEligibilityWire(value: unknown, kind: keyof typeof schemas) {
  assertSchemaValid(value, schemas[kind], {
    errorMessage: 'Eligibility wire is invalid or unsupported',
    resolveRef: resolveEligibilityRef,
  });
}
