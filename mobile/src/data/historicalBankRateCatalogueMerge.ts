import { SECTION_KEYS, type CorePayload, type DetailsPayload, type ProductDetail, type RateRow, type SectionKey } from '../types';
import { isValidCalendarDate } from '../lib/calendarDate';
import { toFraction } from './format';
import { RATE_OBSERVATION_FIELDS, rateTierSignature } from './bankRateOverview';
import { prepareHistoricalBankRateCatalogue } from './historicalBankRateCatalogue';
import { HISTORICAL_CATALOGUE_LIMITS, validateHistoricalCatalogueEvidence, validateHistoricalCatalogueSource,
  type HistoricalBankRateCatalogue, type HistoricalCatalogueEvidence, type HistoricalCatalogueSource,
  type HistoricalCatalogueSpan, type HistoricalCatalogueTier, type HistoricalRateDescriptor } from './historicalBankRateCatalogueWire';

type PublishedSource = Extract<HistoricalCatalogueSource, { kind: 'published_core' }>;
const unknownEvidence: HistoricalCatalogueEvidence = { status: 'unknown' };
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');

/** Only validated shallow evidence reaches this stable dictionary identity. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function rowIdentity(row: RateRow, section: SectionKey): string {
  return JSON.stringify([section, row.provider, row.product_id, row.product_key, row.category, row.product_name]);
}

function publishedEvidence(row: RateRow, section: SectionKey, detail: ProductDetail | undefined): HistoricalCatalogueEvidence {
  if (!record(detail)) return unknownEvidence;
  if (detail.displayIdentity !== undefined) {
    if (!record(detail.displayIdentity)) return unknownEvidence;
    for (const [field, expected] of [['name', row.product_name], ['provider', row.provider], ['productCategory', row.category]] as const) {
      const actual = detail.displayIdentity[field];
      if (actual !== undefined && (typeof actual !== 'string' || typeof expected !== 'string' || normalized(actual) !== normalized(expected))) return unknownEvidence;
    }
  }
  const projected: ProductDetail = {};
  if (detail.description !== undefined) {
    if (typeof detail.description !== 'string') return unknownEvidence;
    if (detail.description.trim()) projected.description = detail.description;
  }
  for (const key of ['eligibility', 'constraints', 'facts'] as const) {
    const items = detail[key];
    if (items === undefined) continue;
    if (!Array.isArray(items) || !items.every(record)) return unknownEvidence;
    // Match producer compaction so empty arrays cannot create duplicate evidence editions.
    // The complete candidate is runtime-validated below; malformed variants make it unknown.
    if (key === 'facts') {
      const features = items.filter(item => item.kind === 'feature');
      if (features.length) projected.facts = features as unknown as ProductDetail['facts'];
    } else if (items.length) projected[key] = items;
  }
  const candidate: HistoricalCatalogueEvidence = { status: 'known', identity: { provider: row.provider, product_id: row.product_id!,
    product_key: row.product_key, category: row.category!, dataset: section }, detail: projected };
  return validateHistoricalCatalogueEvidence(candidate) ? candidate : unknownEvidence;
}

function replaceDay(spans: HistoricalCatalogueSpan[], index: number, shift: number): HistoricalCatalogueSpan[] {
  return spans.flatMap(([oldStart, count, rates, evidenceId]) => {
    const start = oldStart + shift, end = start + count;
    if (index < start || index >= end) return [[start, count, rates, evidenceId] as HistoricalCatalogueSpan];
    const result: HistoricalCatalogueSpan[] = [];
    if (index > start) result.push([start, index - start, rates, evidenceId]);
    if (index + 1 < end) result.push([index + 1, end - index - 1, rates, evidenceId]);
    return result;
  });
}

function coalesce(spans: HistoricalCatalogueSpan[]): HistoricalCatalogueSpan[] {
  const result: HistoricalCatalogueSpan[] = [];
  for (const span of spans.sort(([a], [b]) => a - b)) {
    const previous = result.at(-1);
    if (previous && previous[0] + previous[1] === span[0] && previous[3] === span[3] &&
        previous[2].length === span[2].length && previous[2].every((value, index) => value === span[2][index])) previous[1] += span[1];
    else result.push([...span] as HistoricalCatalogueSpan);
  }
  return result;
}

/** Replace one verified date for every tier. No source/network lookup and no
 * mutation of either edition, shared current rows or current eligibility gates. */
export function upsertHistoricalCatalogueDay(catalogue: HistoricalBankRateCatalogue | null, core: CorePayload,
  details: DetailsPayload | null, source: PublishedSource): HistoricalBankRateCatalogue {
  if (!isValidCalendarDate(core.run_date) || source.kind !== 'published_core' || !validateHistoricalCatalogueSource(source) ||
      (catalogue && !prepareHistoricalBankRateCatalogue(catalogue))) throw new Error('Invalid historical catalogue update identity');
  const first = catalogue && catalogue.run_dates[0] < core.run_date ? catalogue.run_dates[0] : core.run_date;
  const last = catalogue && catalogue.run_dates.at(-1)! > core.run_date ? catalogue.run_dates.at(-1)! : core.run_date;
  const dayCount = (Date.parse(last) - Date.parse(first)) / 86_400_000 + 1;
  if (dayCount > HISTORICAL_CATALOGUE_LIMITS.days) throw new Error('Historical catalogue date budget exceeded');
  const dates = Array.from({ length: dayCount }, (_, index) => new Date(Date.parse(first) + index * 86_400_000).toISOString().slice(0, 10));
  const index = dates.indexOf(core.run_date), shift = catalogue ? dates.indexOf(catalogue.run_dates[0]) : 0;
  const evidence = catalogue ? [...catalogue.evidence] : [unknownEvidence];
  const evidenceIds = new Map(evidence.map((item, id) => [canonical(item), id]));
  // Multiple rate tiers share one verified product identity and detail edition.
  // Resolve and canonicalize that evidence once, not once per balance/LVR tier.
  const productEvidenceIds = new Map<string, number>();
  const identities = new Map<string, Set<string>>();
  for (const section of SECTION_KEYS) for (const row of core.sections[section].rates) {
    const grouped = identities.get(row.product_key) ?? new Set<string>();
    grouped.add(rowIdentity(row, section)); identities.set(row.product_key, grouped);
  }
  const sections = Object.fromEntries(SECTION_KEYS.map(section => {
    const tiers: HistoricalCatalogueTier[] = (catalogue?.sections[section] ?? []).map(tier => ({ row: tier.row, spans: replaceDay(tier.spans, index, shift) }));
    const tierIds = new Map(tiers.map((tier, id) => [rateTierSignature(tier.row as RateRow), id]));
    const observed = new Map<number, { rates: number[]; evidenceId: number }>();
    for (const row of core.sections[section].rates) {
      const value = toFraction(row.rate);
      if (value === null) continue;
      const signature = rateTierSignature(row);
      let id = tierIds.get(signature);
      if (id === undefined) {
        id = tiers.length; tierIds.set(signature, id);
        tiers.push({ row: Object.fromEntries(Object.entries(row).filter(([key]) => !RATE_OBSERVATION_FIELDS.has(key))) as HistoricalRateDescriptor, spans: [] });
      }
      let observation = observed.get(id);
      if (!observation) {
        let evidenceId = productEvidenceIds.get(row.product_key);
        if (evidenceId === undefined) {
          const item = details?.run_date === core.run_date && identities.get(row.product_key)?.size === 1
            ? publishedEvidence(row, section, record(details.products) ? details.products[row.product_key] : undefined) : unknownEvidence;
          const identity = canonical(item);
          evidenceId = evidenceIds.get(identity);
          if (evidenceId === undefined) { evidenceId = evidence.length; evidenceIds.set(identity, evidenceId); evidence.push(item); }
          productEvidenceIds.set(row.product_key, evidenceId);
        }
        observation = { rates: [], evidenceId }; observed.set(id, observation);
      }
      observation.rates.push(value * 100);
    }
    for (const [id, observation] of observed) tiers[id].spans.push([index, 1, observation.rates.sort((a, b) => a - b), observation.evidenceId]);
    for (const tier of tiers) tier.spans = coalesce(tier.spans);
    return [section, tiers];
  })) as HistoricalBankRateCatalogue['sections'];
  const unavailable_dates = { ...catalogue?.unavailable_dates }; delete unavailable_dates[core.run_date];
  const result: HistoricalBankRateCatalogue = { schema_version: 2, run_dates: dates, sections, evidence,
    sources: { ...catalogue?.sources, [core.run_date]: source }, unavailable_dates };
  if (!prepareHistoricalBankRateCatalogue(result)) throw new Error('Invalid historical catalogue update');
  return result;
}
