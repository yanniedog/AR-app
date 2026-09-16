import type { FilteredSearchSnapshot } from '../data/filteredSearchSnapshot';
import { searchReportTables } from './searchReportTables';
import { escapeReportMarkup as escape } from './searchReportWorkbook';

export async function searchReportHtml(snapshot: FilteredSearchSnapshot, checkpoint: () => void): Promise<string> {
  const sections: string[] = [];
  for (const sheet of searchReportTables(snapshot)) {
    checkpoint();
    await new Promise(resolve => setTimeout(resolve, 0));
    const [heading, ...rows] = sheet.rows;
    const body: string[] = [];
    for (let index = 0; index < rows.length; index += 1) {
      if (index % 128 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); checkpoint(); }
      body.push(`<tr>${rows[index].map(value => `<td>${escape(value).replace(/\n/g, '<br/>')}</td>`).join('')}</tr>`);
    }
    sections.push(`<section><h2>${escape(sheet.name)}</h2><table><thead><tr>${heading.map(value => `<th>${escape(value)}</th>`).join('')}</tr></thead><tbody>${body.join('')}</tbody></table></section>`);
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>@page{size:A4;margin:14mm}body{font:10pt sans-serif;color:#111}h1{font-size:18pt}h2{font-size:14pt;break-after:avoid}section{break-before:page}section:first-of-type{break-before:auto}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:5px;border:1px solid #ccc;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap}th{background:#eee;text-align:left}thead{display:table-header-group}tr{break-inside:auto}p{line-height:1.4}</style></head><body><h1>Search results</h1><p>Published ${escape(snapshot.publicationDate)} · Revision ${snapshot.publicationRevision ?? 'unavailable'}<br/>Generated ${escape(snapshot.generatedAt)}<br/>${snapshot.products.length} products · ${snapshot.rows.length} matching rate variants</p>${sections.join('')}</body></html>`;
  if (html.length > 64 * 1024 * 1024) throw Error('PDF content exceeds the local generation limit. No partial report was exported.');
  return html;
}
