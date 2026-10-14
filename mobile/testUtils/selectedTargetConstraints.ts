import { bindVerifiedDetails } from '../src/data/detailsIdentity';
import { normalizeCoreWithIntegrity } from '../src/data/sectionIntegrity';
import { rateConditionId } from '../src/data/rateConditions';
import type { CorePayload, DetailsPayload, RateRow, SectionKey } from '../src/types';
import { revisionManifest } from './payloadRevision';

/** Test publication proof; the clauses do not establish a bank eligibility rule. */
export function selectedConstraintFixture(section: SectionKey, inputRows: RateRow[], clauses: { rateIndex: number; text: string }[]) {
  const ribbon = { counts: { rates: 0, products: 0, providers: 0 }, range: { min: null, max: null, mean: null, median: null }, providers: [] };
  const coreInput: CorePayload = { schema_version: 1, run_date: '2026-10-14', brands: {}, rba: [],
    sections: { Mortgage: { rates: section === 'Mortgage' ? inputRows : [], ribbon },
      Savings: { rates: section === 'Savings' ? inputRows : [], ribbon }, TD: { rates: section === 'TD' ? inputRows : [], ribbon } } };
  const manifest = { ...revisionManifest(1), run_date: coreInput.run_date };
  const { core, integrity: coreIntegrity } = normalizeCoreWithIntegrity(coreInput, { coreSha256: manifest.files.core.sha256 });
  const family = section === 'Mortgage' ? 'lending' : 'deposit';
  const sourceSha256 = 'a'.repeat(64);
  const details: DetailsPayload = { schema_version: 1, run_date: core.run_date, products: Object.fromEntries(inputRows.map(row => [row.product_key, {
    rateConditions: { schemaVersion: 1, sourceSha256, entries: clauses.filter(clause => inputRows.some(candidate => candidate.product_key === row.product_key && candidate.rate_index === clause.rateIndex)).map(clause => {
      const rateSourcePointer = `/data/${family}Rates/${clause.rateIndex - 1}`;
      const sourcePointer = `${rateSourcePointer}/additionalInfo`;
      return { id: rateConditionId(sourceSha256, sourcePointer), rateFamily: family, rateIndex: clause.rateIndex,
        rateSourcePointer, sourcePointer, text: clause.text };
    }) },
  }])) };
  bindVerifiedDetails(details, manifest.files.details.sha256);
  return { core, details, manifest, coreIntegrity, rows: core.sections[section].rates };
}
