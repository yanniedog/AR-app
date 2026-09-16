import type { FilteredSearchSnapshot } from '../data/filteredSearchSnapshot';
export interface ReportSheet { name: string; rows: string[][] }
export const REPORT_SHEETS = ['Summary', 'Filters', 'Products', 'Rates and Tiers', 'Fees', 'Features', 'Eligibility and Constraints', 'Terms and Sources', 'Coverage'] as const;

/** Lossless paths retain every supplied value, unit, identifier and unknown state. */
export function reportFields(value: unknown, path = ''): [string, string, string][] {
  if (value === undefined) return [[path, 'unavailable', '']];
  if (value === null) return [[path, 'null', '']];
  if (Array.isArray(value) && !value.length) return [[path, 'array', '[]']];
  if (typeof value === 'object') {
    const entries = Object.entries(value);
    return entries.length ? entries.flatMap(([key, child]) => reportFields(child, `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`)) : [[path, 'object', '{}']];
  }
  return [[path, typeof value, String(value)]];
}

export function searchReportTables(snapshot: FilteredSearchSnapshot): ReportSheet[] {
  const sheets = REPORT_SHEETS.map(name => ({ name, rows: [] as string[][] }));
  const [summary, filters, products, rates, fees, features, eligibility, terms, coverage] = sheets;
  summary.rows = [['Field', 'State', 'Value'], ...reportFields({ publicationDate: snapshot.publicationDate, publicationRevision: snapshot.publicationRevision, generatedAt: snapshot.generatedAt, australianDate: snapshot.australianDate, productCount: snapshot.products.length, matchingRateCount: snapshot.rows.length, coreSha256: snapshot.coreSha256, detailsSha256: snapshot.detailsSha256, bundleSha256: snapshot.bundleSha256, query: snapshot.request.query, sorting: snapshot.request.sort })];
  filters.rows = [['Field', 'State', 'Value'], ...reportFields({ mandatory: snapshot.mandatoryRequirements, screen: snapshot.request })];
  products.rows = [['Rank', 'Product key', 'Field', 'State', 'Value']];
  rates.rows = [['Rank', 'Product key', 'Variant', 'Field', 'State', 'Value']];
  for (const sheet of [fees, features, eligibility, terms]) sheet.rows = [['Product key', 'Field', 'State', 'Value']];
  for (const product of snapshot.products) {
    const first = snapshot.rows.find(row => row.product_key === product.productKey)!;
    const identity = { name: first.product_name, provider: first.provider, productId: first.product_id, description: product.detail?.description, last_updated: product.detail?.last_updated };
    products.rows.push(...reportFields(identity).map(fields => [String(product.rank), product.productKey, ...fields]));
    const detail = product.detail;
    for (const [sheet, value] of [
      [fees, { fees: detail?.fees, facts: detail?.facts?.filter(fact => fact.kind === 'fee') }],
      [features, { features: detail?.features, facts: detail?.facts?.filter(fact => fact.kind === 'feature') }],
      [eligibility, { eligibility: detail?.eligibility, constraints: detail?.constraints, facts: detail?.facts?.filter(fact => ['eligibility', 'constraint'].includes(fact.kind)) }],
      [terms, { links: detail?.links, sourceDocuments: detail?.sourceDocuments, rateConditions: detail?.rateConditions, remainingFacts: detail?.facts?.filter(fact => !['fee', 'feature', 'eligibility', 'constraint'].includes(fact.kind)), displayIdentity: detail?.displayIdentity }],
    ] as [ReportSheet, unknown][]) sheet.rows.push(...reportFields(value).map(fields => [product.productKey, ...fields]));
  }
  snapshot.rows.forEach((row, index) => rates.rows.push(...reportFields(row).map(fields => [String(index + 1), row.product_key, row.rate_index == null ? 'unavailable' : String(row.rate_index), ...fields])));
  coverage.rows = [['Limitation'], ...snapshot.coverage.map(value => [value])];
  return sheets;
}
