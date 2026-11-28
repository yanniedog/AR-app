import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function rateSummary(dir) {
  const file = path.join(dir, 'rate-evidence.json');
  if (!fs.existsSync(file)) return ['**Rate evidence incomplete** · No verification receipt', ''];
  const r = JSON.parse(fs.readFileSync(file, 'utf8'));
  const lines = [`**Rate evidence: ${r.outcome}** · Published edition ${r.source?.tag ?? 'unavailable'}`, ''];
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
    `CDR values within rate type and published term: ${counts(r.bankRowStates)}. Retail website pricing was not measured.`, '');
  for (const c of r.checkpoints ?? []) {
    if (c.errors.length) lines.push(`- ${c.step}: ${c.errors.join(', ')}`);
  }
  return [...lines, ''];
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(rateSummary(process.argv[2]).join('\n'));
