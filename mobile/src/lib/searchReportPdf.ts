import type { FilteredSearchSnapshot } from '../data/filteredSearchSnapshot';
import { searchReportTables } from './searchReportTables';
import { escapeReportMarkup as escape } from './searchReportWorkbook';

export async function searchReportHtml(snapshot: FilteredSearchSnapshot, checkpoint: () => void): Promise<string> {
  const sections: string[] = [];
  let contentLength = 0;
  const append = (body: string[], html: string) => {
    contentLength += html.length;
    if (contentLength > 64 * 1024 * 1024) throw Error('PDF content exceeds the local generation limit. No partial report was exported.');
    body.push(html);
  };
  const cells = (values: string[], tag: 'th' | 'td') => values.map(value => `<${tag}>${escape(value).replace(/\n/g, '<br/>')}</${tag}>`).join('');
  for (const sheet of searchReportTables(snapshot)) {
    checkpoint();
    await new Promise(resolve => setTimeout(resolve, 0));
    const [heading, ...rows] = sheet.rows;
    const body: string[] = [];
    // Product/variant identifiers belong in group headings, not in every fact row.
    // Keep every field and unknown state while avoiding quadratic visual repetition.
    const prefix = sheet.name === 'Products' ? 2 : sheet.name === 'Rates and Tiers' ? 3
      : ['Fees', 'Features', 'Eligibility and Constraints', 'Terms and Sources'].includes(sheet.name) ? 1 : 0;
    let group: string | null = null;
    const openTable = () => append(body, `<table><thead><tr>${cells(heading.slice(prefix), 'th')}</tr></thead><tbody>`);
    if (!prefix || !rows.length) openTable();
    for (let index = 0; index < rows.length; index += 1) {
      if (index % 128 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); checkpoint(); }
      const row = rows[index];
      if (prefix) {
        const next = JSON.stringify(row.slice(0, prefix));
        if (next !== group) {
          if (group !== null) append(body, '</tbody></table>');
          append(body, `<h3>${row.slice(0, prefix).map((value, column) => `${escape(heading[column])}: <span>${escape(value)}</span>`).join(' · ')}</h3>`);
          openTable(); group = next;
        }
      }
      append(body, `<tr>${cells(row.slice(prefix), 'td')}</tr>`);
    }
    append(body, '</tbody></table>');
    sections.push(`<section><h2>${escape(sheet.name)}</h2>${body.join('')}</section>`);
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>@page{size:A4;margin:14mm}body{font:10pt sans-serif;color:#111}h1{font-size:18pt}h2{font-size:14pt;break-after:avoid}h3{font-size:11pt;break-after:avoid;overflow-wrap:anywhere}section{break-before:page}section:first-of-type{break-before:auto}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:5px;border:1px solid #ccc;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap}th{background:#eee;text-align:left}thead{display:table-header-group}tr{break-inside:auto}p{line-height:1.4}</style></head><body><h1>Search results</h1><p>Published ${escape(snapshot.publicationDate)} · Revision ${snapshot.publicationRevision ?? 'unavailable'}<br/>Generated ${escape(snapshot.generatedAt)}<br/>${snapshot.products.length} products · ${snapshot.rows.length} matching rate variants</p>${sections.join('')}</body></html>`;
  if (html.length > 64 * 1024 * 1024) throw Error('PDF content exceeds the local generation limit. No partial report was exported.');
  return html;
}
