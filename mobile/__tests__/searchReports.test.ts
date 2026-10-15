import { unzipSync, strFromU8 } from 'fflate';
import type { CorePayload, DetailsPayload, Manifest, RateRow } from '../src/types';
import { EMPTY_PROFILE } from '../src/data/profile';
import { EMPTY_FILTERS, filterRows, sortRows } from '../src/data/selectors';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { australianPublicationDate, captureFilteredSearchSnapshot, type SearchReportRequest } from '../src/data/filteredSearchSnapshot';
import { searchReportTables, REPORT_SHEETS } from '../src/lib/searchReportTables';
import { writeReportWorkbook } from '../src/lib/searchReportWorkbook';
import { searchReportHtml } from '../src/lib/searchReportPdf';
import { uiLabel, type UiText } from '../src/lib/uiCopy';
import { selectedConstraintFixture } from '../testUtils/selectedTargetConstraints';

const request: SearchReportRequest = { section: 'Mortgage', path: [], hierarchyScoped: false, query: '', filters: { ...EMPTY_FILTERS, includeNonStandard: true }, sort: 'rate', mortgageMetric: 'headline', depositMetric: 'base', deepSearch: false };
const rows: RateRow[] = Array.from({ length: 61 }, (_, index) => ({ product_key: `product-${index}`, product_name: `Loan ${index}`, provider: 'Bank', rate_index: 0, rate: '0.05000000000000000001' }));
const core = { run_date: '2026-09-15', sections: { Mortgage: { rates: rows }, Savings: { rates: [] }, TD: { rates: [] } } } as unknown as CorePayload;
const manifest = { run_date: core.run_date, files: { core: { sha256: 'a'.repeat(64) }, details: { sha256: 'b'.repeat(64) } }, payload_revision: { revision: 3, bundle_sha256: 'c'.repeat(64) } } as Manifest;
const details: DetailsPayload = { schema_version: 1, run_date: core.run_date, products: Object.fromEntries(rows.map((row, index) => [row.product_key, { facts: [{ id: 'offset', kind: 'feature', canonicalKey: 'OFFSET', unit: 'boolean', value: index !== 1 }], description: index === 0 ? '=HYPERLINK("https://example.invalid") <script>bad</script> 日本語 😀' : 'Terms', fees: index === 0 ? [] : undefined }])) };
const profile = { ...EMPTY_PROFILE, accountFeatures: ['OFFSET'] };
const capture = () => { installMandatoryEligibility(selectMandatoryEligibility(core, profile, details.products)); return captureFilteredSearchSnapshot({ core, manifest, details, profile, request, now: new Date('2026-09-16T02:00:00Z') }); };
afterEach(() => installMandatoryEligibility(selectMandatoryEligibility(null, EMPTY_PROFILE, null)));

test('same full result set as UI, frozen source copies, exact decimals and explicit older date', async () => {
  const snapshot = capture();
  const ui = filterRows(sortRows(rows, request.sort, request.section, request.depositMetric, request.mortgageMetric), request.filters, details.products, null, request.section);
  expect(snapshot.rows.map(row => row.product_key)).toEqual(ui.map(row => row.product_key));
  expect(snapshot.products).toHaveLength(60);
  expect(snapshot.rows[0].rate).toBe('0.05000000000000000001');
  expect(snapshot.coverage).toContainEqual({ kind: 'publication-day', state: 'older', publicationDate: '2026-09-15', australianDate: '2026-09-16' });
  expect(Object.isFrozen(snapshot.rows[0])).toBe(true);
  expect(snapshot.rows[0]).not.toBe(rows[0]);
  const tables = searchReportTables(snapshot);
  expect(tables.map(sheet => sheet.name)).toEqual(REPORT_SHEETS);
  const workbook = unzipSync(await writeReportWorkbook(tables));
  const pdf = await searchReportHtml(snapshot, () => undefined);
  expect(Object.keys(workbook).filter(path => path.startsWith('xl/worksheets/'))).toHaveLength(9);
  const productSheet = strFromU8(workbook['xl/worksheets/sheet3.xml']);
  for (const product of snapshot.products) { expect(productSheet).toContain(`>${product.productKey}<`); expect(pdf).toContain(`>${product.productKey}<`); }
  expect(productSheet).not.toContain('>product-1<'); expect(pdf).not.toContain('>product-1<');
  expect(pdf).not.toContain('<script>'); expect(pdf).not.toContain('&lt;script&gt;');
  expect(productSheet).not.toContain('<f>'); expect(productSheet).not.toContain('=HYPERLINK');
  expect(strFromU8(workbook['xl/worksheets/sheet4.xml'])).toContain('0.05000000000000000001');
});

test('PDF groups product identifiers without dropping their specifications', async () => {
  const html = await searchReportHtml(capture(), () => undefined);
  const products = html.split('<h2>Products</h2>')[1].split('</section>')[0];
  expect(products.match(/<span>product-0<\/span>/g)).toHaveLength(1);
  expect(products).toContain('<td>Product</td><td>Known</td><td>Loan 0</td>');
  expect(products).toContain('<td>Product ID</td><td>Unavailable</td><td></td>');
  expect(products).not.toContain('日本語 😀');
  expect(products).not.toContain('>product-1<');
  expect(html).toContain('<td>Fees</td><td>Empty</td><td>0</td>');
});

test('long Unicode terms retain every segment; formula and OOXML escapes stay literal', async () => {
  const text = '😀'.repeat(32001) + '_x0041_\u0001';
  // Encoder adversaries intentionally bypass presentation typing in this isolated test.
  const bytes = await writeReportWorkbook([{ name: 'Terms', rows: [[uiLabel('Value')], ...[text, '+SUM(1,2)', '@x', '-1', '=1+1'].map(value => [value as UiText])] }]);
  const xml = strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']);
  expect(xml.match(/😀/g)).toHaveLength(32001);
  expect(xml).toContain('_x005F_x0041_'); expect(xml).toContain('_x0001_');
  expect(xml).not.toContain('<f>'); expect(xml).toContain('>Part<'); expect(xml).toContain('>Parts<');
});

test('source carriage returns survive XML parsing without changing literal OOXML tokens', async () => {
  const text = 'CR\rCRLF\r\nLF\nTAB\t_x000D_ 日本語';
  const splitText = 'a'.repeat(31999) + '\r\nnext';
  const bytes = await writeReportWorkbook([{ name: 'Terms', rows: [[uiLabel('Value')], [text as UiText], [splitText as UiText]] }]);
  const xml = strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']);
  expect(xml).not.toContain('\r');
  expect(xml).toContain('CR_x000d_CRLF_x000d_\nLF\nTAB\t_x005F_x000D_ 日本語');
  expect(xml).toContain('a_x000d_</t>');
  expect(xml).toContain('>\nnext</t>');
});

test('empty result, Australian day rollover and cancellation are explicit', async () => {
  const snapshot = captureFilteredSearchSnapshot({ core, manifest, details, profile: EMPTY_PROFILE, request: { ...request, query: 'no-match-value' }, now: new Date('2026-09-15T15:00:00Z') });
  expect(snapshot.rows).toEqual([]); expect(australianPublicationDate(new Date('2026-09-15T15:00:00Z'))).toBe('2026-09-16');
  expect(await searchReportHtml(snapshot, () => undefined)).toContain('<td>Product count</td><td>Known</td><td>0</td>');
  await expect(writeReportWorkbook(searchReportTables(snapshot), () => { throw Error('cancelled'); })).rejects.toThrow('cancelled');
  await expect(searchReportHtml(snapshot, () => { throw Error('cancelled'); })).rejects.toThrow('cancelled');
});

test('exports exact admitted sibling LVR facts before cloning and keeps missing proof unverified', async () => {
  const loan: RateRow = { provider: 'Maitland Mutual Limited', product_name: 'Budget Home Loan', product_key: 'maitland-budget', rate: '0.0579', rate_index: 4, lvr_tier: 'lvr_=60%' };
  const publication = selectedConstraintFixture('Mortgage', [loan, { ...loan, rate_index: 5 }], [{ rateIndex: 4, text: 'LVR up to 59.99%.' }, { rateIndex: 5, text: 'For LVR 60% to 79.99%.' }]);
  installMandatoryEligibility(selectMandatoryEligibility(publication.core, EMPTY_PROFILE, publication.details.products));
  const snapshot = captureFilteredSearchSnapshot({ ...publication, request, profile: EMPTY_PROFILE });
  const rateRows = searchReportTables(snapshot).find(sheet => sheet.name === 'Rates and Tiers')!.rows;
  expect(rateRows.some(row => row[2] === '4' && row[3] === 'Conditions' && row[5] === 'LVR ≤59.99%')).toBe(true);
  expect(rateRows.some(row => row[2] === '5' && row[3] === 'Conditions' && row[5] === 'LVR 60%–79.99%')).toBe(true);
  const html = await searchReportHtml(snapshot, () => undefined);
  expect(html).not.toContain('LVR up to'); expect(html).not.toContain('For LVR'); expect(html).toContain('Unverified');
  const unverified = captureFilteredSearchSnapshot({ ...publication, coreIntegrity: null, request, profile: EMPTY_PROFILE });
  expect(searchReportTables(unverified).find(sheet => sheet.name === 'Rates and Tiers')!.rows.some(row => row[5] === 'Source unverified')).toBe(true);
});

test('PDF and workbook reject marketing, source labels, error-like prose and private query while retaining numeric source facts', async () => {
  const row: RateRow = { provider: 'Bank', product_id: 'id-1', category: 'TRANS_AND_SAVINGS_ACCOUNTS', product_name: 'Deposit', product_key: 'Bank|id-1|TRANS_AND_SAVINGS_ACCOUNTS|Deposit', rate_index: 1, rate: '0.05000000000000000001', ongoing_rate: '0', ribbon_deposit_kind: 'intro', term: 'P6M' };
  const publication = selectedConstraintFixture('Savings', [row], [{ rateIndex: 1, text: 'A necessary condition that this narrow parser cannot classify.' }]);
  const detail = publication.details.products[row.product_key];
  detail.description = 'BUY NOW. This explanatory description must not render.';
  detail.fees = [{ name: 'Arbitrary promotional fee label.', amountStatus: 'fixed', amount: '123456789.123456789012345678', info: 'Please read this fee paragraph.', currency: 'AUD' }];
  detail.features = [{ label: 'OFFSET', value: 'false', info: 'Here is the long source explanation.' }];
  detail.sourceDocuments = [{ url: 'https://bank.test/terms', sourcePath: '/additionalInformation/terms', relation: 'terms', label: 'Promotional document label.' }];
  installMandatoryEligibility(selectMandatoryEligibility(publication.core, EMPTY_PROFILE, publication.details.products));
  // Snapshot selection still uses the actual supplied query. A matching identity
  // makes this input eligible without exporting its free-form display text.
  const scopedRequest = { ...request, section: 'Savings' as const, query: 'Deposit' };
  const snapshot = captureFilteredSearchSnapshot({ ...publication, request: scopedRequest, profile: EMPTY_PROFILE });
  expect(snapshot.request.query).toBe('Deposit'); expect(snapshot.rows).toHaveLength(1);
  const tables = searchReportTables(snapshot), workbook = unzipSync(await writeReportWorkbook(tables));
  const exported = Object.values(workbook).map(bytes => strFromU8(bytes)).join('\n') + await searchReportHtml(snapshot, () => undefined);
  for (const prose of [detail.description, detail.fees[0].info!, detail.fees[0].name!, detail.features[0].info!, detail.sourceDocuments[0].label!, publication.details.products[row.product_key].rateConditions!.entries[0].text]) expect(exported).not.toContain(prose);
  expect(exported).toContain('123456789.123456789012345678'); expect(exported).toContain('0.05000000000000000001');
  expect(exported).toContain('Ongoing rate: 0.00%'); expect(exported).toContain('6 months'); expect(exported).toContain('Introductory');
  expect(exported).toContain('Source review required'); expect(exported).toContain('/data/depositRates/0/additionalInfo');
  expect(exported).toContain('No'); expect(exported).toContain('Bank|id-1|TRANS_AND_SAVINGS_ACCOUNTS|Deposit');
});
