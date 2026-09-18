import { strToU8, zipSync } from 'fflate';
import type { ReportSheet } from './searchReportTables';

export function escapeReportMarkup(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
}
function xmlText(value: string): string {
  // Excel decodes these escape sequences even in inline strings. Escape literal tokens first.
  // XML normalizes raw CR/CRLF, so encode carriage returns to preserve source text exactly.
  return escapeReportMarkup(value.replace(/_x[\da-f]{4}_/gi, match => `_x005F_${match.slice(1)}`)
    .replace(/[\x00-\x08\x0B-\x1F]/g, char => `_x${char.charCodeAt(0).toString(16).padStart(4, '0')}_`));
}
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Text cells preserve exact decimals and IDs, and cannot execute spreadsheet formulas. */
export async function writeReportWorkbook(sheets: ReportSheet[], checkpoint: () => void = () => undefined): Promise<Uint8Array> {
  const files: Record<string, Uint8Array> = {};
  const put = (name: string, value: string) => { files[name] = strToU8(XML + value); };
  for (const [index, sheet] of sheets.entries()) {
    checkpoint();
    if (!sheet.name || sheet.name.length > 31 || /[\\/?*\[\]:]/.test(sheet.name)) throw Error('Invalid worksheet name.');
    let number = 0;
    const rows: string[] = [];
    for (const [record, values] of sheet.rows.entries()) {
      if (record % 128 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); checkpoint(); }
      const chunks = values.map(value => {
        const result: string[] = [];
        for (let offset = 0; offset < value.length;) {
          let end = Math.min(offset + 32000, value.length);
          if (end < value.length && /[\uD800-\uDBFF]/.test(value[end - 1])) end -= 1;
          result.push(value.slice(offset, end)); offset = end;
        }
        return result.length ? result : [''];
      });
      // Excel's 32767-character cell limit: retain every segment in explicit continuation rows.
      const parts = Math.max(1, ...chunks.map(value => value.length));
      for (let part = 0; part < parts; part += 1) {
        if (++number > 1048576) throw Error('Workbook exceeds worksheet row limit; no file was exported.');
        const cells = record === 0 ? ['Record', 'Part', 'Parts', ...values] : [String(record), String(part + 1), String(parts), ...chunks.map(value => value[part] ?? '')];
        rows.push(`<row r="${number}">${cells.map((value, column) => `<c r="${String.fromCharCode(65 + column)}${number}" t="inlineStr"><is><t xml:space="preserve">${xmlText(value)}</t></is></c>`).join('')}</row>`);
      }
    }
    put(`xl/worksheets/sheet${index + 1}.xml`, `<worksheet xmlns="${MAIN}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="2" width="8" customWidth="1"/><col min="3" max="12" width="28" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData></worksheet>`);
  }
  put('xl/workbook.xml', `<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>${sheets.map((sheet, index) => `<sheet name="${escapeReportMarkup(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`);
  put('xl/_rels/workbook.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${REL}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}</Relationships>`);
  put('_rels/.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  put('[Content_Types].xml', `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  checkpoint();
  return zipSync(files, { level: 6 });
}
