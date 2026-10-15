import type { FilteredSearchSnapshot, SearchCoverageFact } from '../data/filteredSearchSnapshot';
import type { DetailItem, NormalizedProductFact, ProductDetail, RateRow } from '../types';
import type { ProfileFilters } from '../data/profile';
import type { Filters } from '../data/selectors';
import { normalizedProductFacts } from '../data/productFacts';
import { humanizeEnum, formatTerm } from '../data/format';
import { scopedFinancialConditionFacts } from '../data/scopedFinancialConditionFacts';
import { uiConditionTag } from './financialUiCopy';
import { uiConditionalRateFacts } from './financialUiCopy';
import { rateConditionalFacts } from '../data/rateConditionalFacts';
import { uiDetailItem, uiFeeCap, uiFeeDiscount, uiNormalizedProductFact } from './productUiFacts';
import { uiCount, uiDate, uiDecimal, uiIdentifier, uiJoin, uiLabel, uiProductName, uiProductReference, uiProviderName, uiSectionName, type UiCopy, type UiLabel, type UiText } from './uiCopy';

export interface ReportSheet { name: UiLabel; rows: UiCopy[][] }
export const REPORT_SHEETS = ['Summary', 'Filters', 'Products', 'Rates and Tiers', 'Fees', 'Features', 'Eligibility and Constraints', 'Terms and Sources', 'Coverage'] as const;
const yesNo = (value: boolean): UiText => uiLabel(value ? 'Yes' : 'No');
function decimal(value: unknown): UiText {
  if (typeof value !== 'string' && typeof value !== 'number') return uiLabel('Unknown');
  const source = String(value);
  if (!/^\$?-?(?:\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.\d+)?$/.test(source)) return uiLabel('Unknown');
  const raw = source.replace(/^\$/, '').replace(/,/g, '');
  return uiDecimal(raw, 'count');
}
function enums(values: readonly string[] | undefined): UiText {
  return values?.length ? uiJoin(...values.flatMap((value, index) => index ? [uiLabel(' · '), humanizeEnum(value)] : [humanizeEnum(value)])) : uiLabel('None');
}
function record(sheet: ReportSheet, prefix: readonly UiCopy[], field: UiCopy, value: UiCopy | undefined | null, unit: UiCopy = '', state?: UiLabel): void {
  const status = state ?? (value == null ? 'Unavailable' : value === 'Unknown' || value === 'Unverified' ? 'Unknown' : 'Known');
  sheet.rows.push([...prefix, field, status, value ?? uiLabel(''), unit]);
}
function arrayState(sheet: ReportSheet, prefix: readonly UiCopy[], field: UiCopy, value: readonly unknown[] | undefined): void {
  record(sheet, prefix, field, value ? uiCount(value.length) : null, '', value?.length === 0 ? 'Empty' : undefined);
}
function filters(sheet: ReportSheet, model: ProfileFilters | Filters, scope: UiLabel): void {
  const prefix: UiCopy[] = [];
  record(sheet, prefix, 'Group', uiLabel(scope));
  const dimensions: readonly [keyof ProfileFilters, UiLabel][] = [['loanPurposes', 'Loan purpose'], ['rateTypes', 'Rate type'], ['repaymentTypes', 'Repayment'], ['lvrTiers', 'Listed LVR'], ['depositKinds', 'Rate kind'], ['interestPayments', 'Interest paid'], ['accountFeatures', 'Features']];
  for (const [key, label] of dimensions) record(sheet, prefix, label, key === 'lvrTiers' ? uiJoin(...model[key].flatMap((value, index) => index ? [uiLabel(' · '), uiIdentifier(value)] : [uiIdentifier(value)])) || uiLabel('None') : enums(model[key]));
  if (!('providers' in model)) return;
  record(sheet, prefix, 'Bank', uiJoin(...model.providers.flatMap((provider, index) => index ? [uiLabel(' · '), uiProviderName({ provider })] : [uiProviderName({ provider })])) || uiLabel('None'));
  record(sheet, prefix, 'Eligibility', enums(model.eligibilityCriteria));
  record(sheet, prefix, 'Include non-standard', yesNo(model.includeNonStandard));
  model.factCriteria.forEach(criterion => {
    const operators: Readonly<Record<typeof criterion.operator, UiLabel>> = { exists: 'Included', eq: 'Equal', gte: 'Greater or equal', lte: 'Less or equal' };
    record(sheet, prefix, 'Predicate', uiJoin(uiIdentifier(criterion.canonicalKey ?? criterion.sourceType), ' · ', operators[criterion.operator], ' · ', criterion.operator === 'exists' ? 'Not applicable' : typeof criterion.value === 'boolean' ? yesNo(criterion.value) : criterion.unit === 'enum' || criterion.unit === 'text' ? humanizeEnum(String(criterion.value)) : decimal(criterion.value)), criterion.unit ? humanizeEnum(criterion.unit.toUpperCase()) : 'Unknown');
  });
}
function normalized(sheet: ReportSheet, prefix: readonly UiCopy[], fact: NormalizedProductFact): void {
  const view = uiNormalizedProductFact(fact);
  record(sheet, prefix, view.label, view.value);
  record(sheet, prefix, 'Reference', uiIdentifier(fact.id));
  if (fact.groupId) record(sheet, prefix, 'Group', uiIdentifier(fact.groupId));
  if (fact.parentId) record(sheet, prefix, 'Parent fact', uiIdentifier(fact.parentId));
  if (fact.value !== undefined) record(sheet, prefix, 'Value', typeof fact.value === 'boolean' ? yesNo(fact.value) : fact.unit === 'enum' ? humanizeEnum(String(fact.value)) : fact.unit === 'duration' ? uiIdentifier(String(fact.value)) : decimal(fact.value), fact.unit ? humanizeEnum(fact.unit.toUpperCase()) : 'Unknown');
  if (fact.minValue !== undefined) record(sheet, prefix, 'Minimum value', decimal(fact.minValue), fact.unit ? humanizeEnum(fact.unit.toUpperCase()) : 'Unknown');
  if (fact.maxValue !== undefined) record(sheet, prefix, 'Maximum value', decimal(fact.maxValue), fact.unit ? humanizeEnum(fact.unit.toUpperCase()) : 'Unknown');
  if (fact.cadence) record(sheet, prefix, 'Cadence', uiIdentifier(fact.cadence));
  if (fact.appliesTo?.length) record(sheet, prefix, 'Applies to', enums(fact.appliesTo));
  if (view.conditions === 'source-review-required') record(sheet, prefix, 'Conditions', 'Source review required');
}
function detailItems(sheet: ReportSheet, prefix: readonly UiCopy[], group: 'Fees' | 'Features' | 'Eligibility' | 'Constraints', items: DetailItem[] | undefined): void {
  arrayState(sheet, prefix, group, items);
  items?.forEach((item, index) => {
    const view = uiDetailItem(item, index, group);
    const itemPrefix = [...prefix];
    record(sheet, itemPrefix, uiJoin(group, ' ', uiCount(index + 1), ' · ', view.label), view.value);
    if (view.conditions === 'source-review-required') record(sheet, itemPrefix, 'Conditions', 'Source review required');
    const numeric: readonly [UiLabel, unknown][] = [['Value', item.value], ['Amount', item.amount ?? item.fixedAmount?.amount], ['Fee minimum', item.variable?.feeMinimum], ['Fee maximum', item.variable?.feeMaximum], ['Balance rate', item.balanceRate], ['Transaction rate', item.transactionRate], ['Accrued rate', item.accruedRate], ['Rate', item.rateBased?.rate], ['Fee minimum', item.rateBased?.amountRange?.feeMinimum], ['Fee maximum', item.rateBased?.amountRange?.feeMaximum], ['Additional value', item.additionalValue]];
    numeric.forEach(([label, value]) => { if (value !== undefined) record(sheet, itemPrefix, label, decimal(value), item.currency ? uiIdentifier(item.currency) : 'Unknown'); });
    if (item.currency) record(sheet, itemPrefix, 'Currency', uiIdentifier(item.currency));
    if (item.accrualFrequency || item.rateBased?.accrualFrequency) record(sheet, itemPrefix, 'Accrual frequency', uiIdentifier(item.accrualFrequency ?? item.rateBased?.accrualFrequency));
    if (item.feeMethodUType) record(sheet, itemPrefix, 'Fee method', humanizeEnum(item.feeMethodUType.toUpperCase()));
    if (item.rateBased?.rateType) record(sheet, itemPrefix, 'Rate basis', humanizeEnum(item.rateBased.rateType));
    const cap = uiFeeCap(item); if (cap) { record(sheet, itemPrefix, 'Fee cap', cap); record(sheet, itemPrefix, 'Amount', decimal(item.feeCap)); }
    item.discounts?.forEach(discount => {
      record(sheet, itemPrefix, 'Discount', uiFeeDiscount(discount));
      const values: readonly [UiLabel, unknown][] = [['Amount', discount.amount ?? discount.fixedAmount?.amount], ['Balance rate', discount.balanceRate], ['Transaction rate', discount.transactionRate], ['Accrued rate', discount.accruedRate], ['Rate', discount.feeRate ?? discount.rateBased?.rate], ['Additional value', discount.additionalValue]];
      values.forEach(([label, value]) => { if (value !== undefined) record(sheet, itemPrefix, label, decimal(value)); });
      discount.eligibility?.forEach(criterion => { record(sheet, itemPrefix, 'Eligibility', humanizeEnum(criterion.discountEligibilityType)); if (criterion.additionalValue !== undefined) record(sheet, itemPrefix, 'Additional value', decimal(criterion.additionalValue)); if (criterion.additionalInfo) record(sheet, itemPrefix, 'Conditions', 'Source review required'); });
    });
  });
}
function coverage(sheet: ReportSheet, facts: readonly SearchCoverageFact[]): void {
  facts.forEach(fact => {
    switch (fact.kind) {
      case 'matching-set': record(sheet, [], 'Result set', 'Complete'); record(sheet, [], 'Rate variants', 'Matching'); record(sheet, [], 'Ranking', 'Selected'); break;
      case 'specifications': record(sheet, [], 'Absent specifications', 'Unavailable'); record(sheet, [], 'Empty arrays', 'Empty'); break;
      case 'sources': record(sheet, [], 'Source links', 'Included'); record(sheet, [], 'Document bodies', 'Excluded'); record(sheet, [], 'Independent review', 'Unverified'); break;
      case 'history': record(sheet, [], 'Historical completeness', 'Unverified'); break;
      case 'calculations': record(sheet, [], 'Calculation patterns', 'Unverified'); break;
      case 'publication-day': record(sheet, [], 'Publication day', fact.state === 'older' ? 'Older' : 'Current'); record(sheet, [], 'Published', uiDate(fact.publicationDate)); record(sheet, [], 'Australian date', uiDate(fact.australianDate)); break;
    }
  });
}
export function searchReportTables(snapshot: FilteredSearchSnapshot): ReportSheet[] {
  const sheets: ReportSheet[] = REPORT_SHEETS.map(name => ({ name, rows: [['Field', 'State', 'Value', 'Unit']] }));
  const [summary, filterSheet, products, rates, fees, features, eligibility, terms, coverageSheet] = sheets;
  const metadata: readonly [UiLabel, UiCopy][] = [['Published', uiDate(snapshot.publicationDate)], ['Publication revision', uiCount(snapshot.publicationRevision)], ['Generated', uiIdentifier(snapshot.generatedAt)], ['Australian date', uiDate(snapshot.australianDate)], ['Product count', uiCount(snapshot.products.length)], ['Matching rates', uiCount(snapshot.rows.length)], ['Core SHA256', uiIdentifier(snapshot.coreSha256)], ['Details SHA256', uiIdentifier(snapshot.detailsSha256)], ['Bundle SHA256', uiIdentifier(snapshot.bundleSha256)], ['Query length', uiCount(snapshot.request.query.length)]];
  metadata.forEach(([label, value]) => record(summary, [], label, value));
  record(summary, [], 'Search', snapshot.request.query ? 'Entered' : 'None');
  record(summary, [], 'Sort', snapshot.request.sort === 'bank' ? 'Bank' : snapshot.request.sort === 'comparison' ? 'Comparison rate' : 'Advertised rate');
  record(filterSheet, [], 'Section', uiSectionName(snapshot.request.section));
  record(filterSheet, [], 'Hierarchy scope', yesNo(snapshot.request.hierarchyScoped));
  record(filterSheet, [], 'Path', uiJoin(...snapshot.request.path.flatMap((part, index) => index ? [uiLabel(' / '), uiIdentifier(part)] : [uiIdentifier(part)])));
  record(filterSheet, [], 'Deep search', yesNo(snapshot.request.deepSearch));
  record(filterSheet, [], 'Deposit metric', snapshot.request.depositMetric === 'max' ? 'Advertised rate' : 'Ongoing rate');
  record(filterSheet, [], 'Mortgage metric', snapshot.request.mortgageMetric === 'comparison' ? 'Comparison rate' : 'Advertised rate');
  filters(filterSheet, snapshot.mandatoryRequirements, 'Mandatory'); filters(filterSheet, snapshot.request.filters, 'Screen filters');
  products.rows[0] = ['Rank', 'Product key', 'Field', 'State', 'Value', 'Unit'];
  rates.rows[0] = ['Rank', 'Product key', 'Variant', 'Field', 'State', 'Value', 'Unit'];
  for (const sheet of [fees, features, eligibility, terms]) sheet.rows[0] = ['Product key', 'Field', 'State', 'Value', 'Unit'];
  for (const product of snapshot.products) {
    const first = snapshot.rows.find(row => row.product_key === product.productKey)!;
    const key = uiProductReference(first), prefix = [uiCount(product.rank), key], detail = product.detail;
    record(products, prefix, 'Product', uiProductName(first)); record(products, prefix, 'Bank', uiProviderName(first)); record(products, prefix, 'Product ID', first.product_id ? uiIdentifier(first.product_id) : null); record(products, prefix, 'Last updated', detail?.last_updated ? uiDate(detail.last_updated) : null);
    detailItems(fees, [key], 'Fees', detail?.fees); detailItems(features, [key], 'Features', detail?.features); detailItems(eligibility, [key], 'Eligibility', detail?.eligibility); detailItems(eligibility, [key], 'Constraints', detail?.constraints);
    normalizedProductFacts(detail).forEach(fact => normalized(fact.kind === 'fee' ? fees : fact.kind === 'feature' ? features : fact.kind === 'eligibility' || fact.kind === 'constraint' ? eligibility : terms, [key], fact));
    const links: readonly [keyof NonNullable<ProductDetail['links']>, UiLabel][] = [['overview', 'Product'], ['eligibility', 'Eligibility'], ['fees', 'Fees'], ['terms', 'Terms'], ['bundle', 'Package']];
    links.forEach(([field, label]) => { if (detail?.links?.[field]) record(terms, [key], label, uiIdentifier(detail.links[field])); });
    arrayState(terms, [key], 'Sources', detail?.sourceDocuments);
    detail?.sourceDocuments?.forEach(source => { record(terms, [key], 'Source', uiIdentifier(source.url)); if (source.sourceUrl) record(terms, [key], 'Source', uiIdentifier(source.sourceUrl)); record(terms, [key], 'Source pointer', uiIdentifier(source.sourcePath)); record(terms, [key], 'Reference', uiIdentifier(source.relation)); });
  }
  snapshot.rows.forEach((row: RateRow, index) => {
    const prefix: UiCopy[] = [uiCount(index + 1), uiProductReference(row), uiCount(row.rate_index)];
    record(rates, prefix, 'Product', uiProductName(row)); record(rates, prefix, 'Bank', uiProviderName(row));
    const numerical: readonly [UiLabel, unknown, UiCopy][] = [['Advertised rate', row.rate, humanizeEnum('FRACTION')], ['Comparison rate', row.comparison_rate, humanizeEnum('FRACTION')], ['Ongoing rate', row.ongoing_rate, humanizeEnum('FRACTION')], ['Minimum balance', row.balance_min, humanizeEnum('AUD')], ['Maximum balance', row.balance_max, humanizeEnum('AUD')], ['Term', row.term_months, 'months']];
    numerical.forEach(([label, value, unit]) => record(rates, prefix, label, value === undefined ? null : decimal(value), unit));
    record(rates, prefix, 'Term', formatTerm(row) || uiLabel('Unknown')); if (row.term) record(rates, prefix, 'Reference', uiIdentifier(row.term));
    const enumFields: readonly [UiLabel, string | undefined][] = [['Rate type', row.rate_type], ['Rate structure', row.ribbon_rate_structure], ['Repayment', row.ribbon_repayment_type ?? row.repayment_type], ['Loan purpose', row.loan_purpose], ['Rate kind', row.ribbon_deposit_kind], ['Interest paid', row.interest_payment], ['Account class', row.account_class], ['Account type', row.account_type], ['Security', row.security_purpose], ['Features', row.feature_set]];
    enumFields.forEach(([label, value]) => record(rates, prefix, label, value === undefined ? null : humanizeEnum(value)));
    const qualifier = rateConditionalFacts(row, snapshot.request.section);
    if (qualifier.facts.length) record(rates, prefix, 'Conditions', uiConditionalRateFacts(qualifier));
    record(rates, prefix, 'Listed LVR', row.lvr_tier === undefined ? null : uiIdentifier(row.lvr_tier)); if (row.last_updated) record(rates, prefix, 'Last updated', uiDate(row.last_updated)); if (row.taxonomy_path) record(rates, prefix, 'Path', uiIdentifier(row.taxonomy_path));
    const admitted = snapshot.rateConditions?.[index];
    if (!admitted) record(rates, prefix, 'Conditions', 'Source unverified');
    else { const model = scopedFinancialConditionFacts(admitted); model.facts.forEach(fact => record(rates, prefix, 'Conditions', uiConditionTag(fact))); model.unresolved.forEach(fact => { record(rates, prefix, 'Conditions', 'Source review required'); record(rates, prefix, 'Source pointer', uiIdentifier(fact.source.sourcePointer)); }); if (model.state === 'unverified') record(rates, prefix, 'Conditions', 'Source unverified'); if (admitted.sourceSha256) record(rates, prefix, 'Source SHA256', uiIdentifier(admitted.sourceSha256)); }
    record(rates, prefix, 'Eligibility', 'Unverified');
  });
  coverage(coverageSheet, snapshot.coverage);
  return sheets;
}
