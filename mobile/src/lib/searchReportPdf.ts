import type { FilteredSearchSnapshot } from '../data/filteredSearchSnapshot';
import { searchReportTables } from './searchReportTables';
import { escapeReportMarkup as escape } from './searchReportWorkbook';
import { uiLabel, uiMarkup, uiMarkupJoin, type UiCopy, type UiMarkup } from './uiCopy';

export async function searchReportHtml(snapshot: FilteredSearchSnapshot, checkpoint: () => void): Promise<UiMarkup> {
  const sections: UiMarkup[] = [];
  let contentLength = 0;
  const append = (body: UiMarkup[], html: UiMarkup) => {
    contentLength += html.length;
    if (contentLength > 64 * 1024 * 1024) throw Error('PDF content exceeds the local generation limit. No partial report was exported.');
    body.push(html);
  };
  const cells = (values: UiCopy[], tag: 'th' | 'td') => uiMarkupJoin(values.map(value => tag === 'th'
    ? uiMarkup`<th>${escape(value)}</th>` : uiMarkup`<td>${escape(value)}</td>`));
  for (const sheet of searchReportTables(snapshot)) {
    checkpoint();
    await new Promise(resolve => setTimeout(resolve, 0));
    const [heading, ...rows] = sheet.rows;
    const body: UiMarkup[] = [];
    // Product/variant identifiers belong in group headings, not in every fact row.
    // Keep every field and unknown state while avoiding quadratic visual repetition.
    const prefix = sheet.name === 'Products' ? 2 : sheet.name === 'Rates and Tiers' ? 3
      : ['Fees', 'Features', 'Eligibility and Constraints', 'Terms and Sources'].includes(sheet.name) ? 1 : 0;
    let group: string | null = null;
    const openTable = () => append(body, uiMarkup`<table><thead><tr>${cells(heading.slice(prefix), 'th')}</tr></thead><tbody>`);
    if (!prefix || !rows.length) openTable();
    for (let index = 0; index < rows.length; index += 1) {
      if (index % 128 === 0) { await new Promise(resolve => setTimeout(resolve, 0)); checkpoint(); }
      const row = rows[index];
      if (prefix) {
        const next = JSON.stringify(row.slice(0, prefix));
        if (next !== group) {
          if (group !== null) append(body, uiMarkup`</tbody></table>`);
          const groupHeading = row.slice(0, prefix).map((value, column) => uiMarkup`${escape(heading[column])}${escape(uiLabel(': '))}<span>${escape(value)}</span>`);
          append(body, uiMarkup`<h3>${uiMarkupJoin(groupHeading.flatMap((part, column) => column ? [escape(uiLabel(' · ')), part] : [part]))}</h3>`);
          openTable(); group = next;
        }
      }
      append(body, uiMarkup`<tr>${cells(row.slice(prefix), 'td')}</tr>`);
    }
    append(body, uiMarkup`</tbody></table>`);
    sections.push(uiMarkup`<section><h2>${escape(sheet.name)}</h2>${uiMarkupJoin(body)}</section>`);
  }
  const html = uiMarkup`<!DOCTYPE html><html><head><meta charset="utf-8"/><style>@page{size:A4;margin:14mm}body{font:10pt sans-serif;color:#111}h1{font-size:18pt}h2{font-size:14pt;break-after:avoid}h3{font-size:11pt;break-after:avoid;overflow-wrap:anywhere}section{break-before:page}section:first-of-type{break-before:auto}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:5px;border:1px solid #ccc;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;white-space:pre-wrap}th{background:#eee;text-align:left}thead{display:table-header-group}tr{break-inside:auto}</style></head><body><h1>${escape(uiLabel('Search results'))}</h1>${uiMarkupJoin(sections)}</body></html>`;
  if (html.length > 64 * 1024 * 1024) throw Error('PDF content exceeds the local generation limit. No partial report was exported.');
  return html;
}
