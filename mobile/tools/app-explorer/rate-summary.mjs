import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function rateSummary(dir) {
  const file = path.join(dir, 'rate-evidence.json');
  if (!fs.existsSync(file)) return ['**Rate evidence incomplete** · No verification receipt', ''];
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  const lines = [`**Rate evidence: ${r.outcome}** · Published edition ${r.source?.tag ?? 'unavailable'} · APK binding ${r.captureBinding ?? 'unverified'}`, ''];
  if (r.error) lines.push(`Collection error: ${r.error}`, '');
  lines.push('| Category | Banks visible / published | Products visible / published |', '| --- | ---: | ---: |');
  for (const [name, c] of Object.entries(r.sectionCoverage ?? {})) {
    lines.push(`| ${name} | ${c.capturedBanks} / ${c.publishedBanks} | ${c.capturedProducts} / ${c.publishedProducts} |`);
  }
  const counts = obj => Object.entries(obj ?? {}).map(([label, n]) => `${label.replaceAll('_', ' ')} ${n}`).join(', ') || 'none measured';
  lines.push('', `Visible tier observations: ${counts(r.rowStates)}`,
    `List-to-detail quotes: ${(r.quotes ?? []).map(q => q.section + ' ' + q.state).join(', ') || 'none measured'}`,
    `Historical changes: ${counts(r.movementStates)}`,
    `Direct bank CDR product checks: ${counts(r.bankProductStates)}`,
    `CDR values within rate type and published term: ${counts(r.bankRowStates)}`,
    `Retail website tables (Judo Bank personal TD and Australian Military Bank Income Plus / Investment Plus): ${counts(r.retailStates)}`, '');
  for (const page of r.retail ?? []) {
    if (page.error) lines.push(`- Retail page unavailable: ${page.url} (${page.error})`);
    const diff = page.rows?.find(row => ['payment_frequency_differs', 'retail_rate_differs'].includes(row.state));
    if (diff) lines.push(`- ${diff.product.split('|').at(-1)}, tier ${diff.tier}, ${diff.termMonths} months: core ${diff.corePercent}% ${diff.coreFrequency}, retail ${JSON.stringify(diff.retailPercentByFrequency)} (${page.url})`);
  }
  for (const c of r.checkpoints ?? []) {
    if (c.errors.length) lines.push(`- ${c.step}: ${c.errors.join(', ')}`);
  }
  return [...lines, ''];
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(rateSummary(process.argv[2]).join('\n'));
