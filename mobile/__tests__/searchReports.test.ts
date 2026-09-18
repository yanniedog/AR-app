import { unzipSync, strFromU8 } from 'fflate';
import type { CorePayload, DetailsPayload, Manifest, RateRow } from '../src/types';
import { EMPTY_PROFILE } from '../src/data/profile';
import { EMPTY_FILTERS, filterRows, sortRows } from '../src/data/selectors';
import { selectMandatoryEligibility } from '../src/data/mandatoryEligibility';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';
import { australianPublicationDate, captureFilteredSearchSnapshot, type SearchReportRequest } from '../src/data/filteredSearchSnapshot';
import { reportFields, searchReportTables, REPORT_SHEETS } from '../src/lib/searchReportTables';
import { writeReportWorkbook } from '../src/lib/searchReportWorkbook';
import { searchReportHtml } from '../src/lib/searchReportPdf';

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
  expect(snapshot.coverage.join(' ')).toContain('not today');
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
  expect(pdf).not.toContain('<script>'); expect(pdf).toContain('&lt;script&gt;');
  expect(productSheet).not.toContain('<f>'); expect(productSheet).toContain('=HYPERLINK');
  expect(strFromU8(workbook['xl/worksheets/sheet4.xml'])).toContain('0.05000000000000000001');
});

test('PDF groups product identifiers without dropping their specifications', async () => {
  const html = await searchReportHtml(capture(), () => undefined);
  const products = html.split('<h2>Products</h2>')[1].split('</section>')[0];
  expect(products.match(/<span>product-0<\/span>/g)).toHaveLength(1);
  expect(products).toContain('<td>/name</td><td>string</td><td>Loan 0</td>');
  expect(products).toContain('<td>/productId</td><td>unavailable</td><td></td>');
  expect(products).toContain('日本語 😀');
  expect(products).not.toContain('>product-1<');
  expect(html).toContain('<td>/fees</td><td>array</td><td>[]</td>');
});

test('long Unicode terms retain every segment; formula and OOXML escapes stay literal', async () => {
  const text = '😀'.repeat(32001) + '_x0041_\u0001';
  const bytes = await writeReportWorkbook([{ name: 'Terms', rows: [['Value'], [text], ['+SUM(1,2)'], ['@x'], ['-1'], ['=1+1']] }]);
  const xml = strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']);
  expect(xml.match(/😀/g)).toHaveLength(32001);
  expect(xml).toContain('_x005F_x0041_'); expect(xml).toContain('_x0001_');
  expect(xml).not.toContain('<f>'); expect(xml).toContain('>Part<'); expect(xml).toContain('>Parts<');
  expect(reportFields({ unknown: null, absent: undefined, zero: 0, no: false, empty: [] })).toEqual([
    ['/unknown', 'null', ''], ['/absent', 'unavailable', ''], ['/zero', 'number', '0'], ['/no', 'boolean', 'false'], ['/empty', 'array', '[]'],
  ]);
});

test('source carriage returns survive XML parsing without changing literal OOXML tokens', async () => {
  const text = 'CR\rCRLF\r\nLF\nTAB\t_x000D_ 日本語';
  const splitText = 'a'.repeat(31999) + '\r\nnext';
  const bytes = await writeReportWorkbook([{ name: 'Terms', rows: [['Value'], [text], [splitText]] }]);
  const xml = strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml']);
  expect(xml).not.toContain('\r');
  expect(xml).toContain('CR_x000d_CRLF_x000d_\nLF\nTAB\t_x005F_x000D_ 日本語');
  expect(xml).toContain('a_x000d_</t>');
  expect(xml).toContain('>\nnext</t>');
});

test('empty result, Australian day rollover and cancellation are explicit', async () => {
  const snapshot = captureFilteredSearchSnapshot({ core, manifest, details, profile: EMPTY_PROFILE, request: { ...request, query: 'no-match-value' }, now: new Date('2026-09-15T15:00:00Z') });
  expect(snapshot.rows).toEqual([]); expect(australianPublicationDate(new Date('2026-09-15T15:00:00Z'))).toBe('2026-09-16');
  expect(await searchReportHtml(snapshot, () => undefined)).toContain('0 products');
  await expect(writeReportWorkbook(searchReportTables(snapshot), () => { throw Error('cancelled'); })).rejects.toThrow('cancelled');
  await expect(searchReportHtml(snapshot, () => { throw Error('cancelled'); })).rejects.toThrow('cancelled');
});
