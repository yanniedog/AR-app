// Groups failed in-app audit checks by cause so a report names what is wrong, not 100+ rows.

const text = e => (e && typeof e === 'object' ? e.message || '' : e || '');

/** One short cause per failed check: the stuck probe, the error text, or the failure code. */
export function failureCause(check) {
  const blocker = check.diagnostic?.readiness?.blockers?.[0];
  if (blocker) return `${blocker.surface} ${blocker.probe} never became ready`;
  const message = text(check.error).replace(/\(\d+ms\)/, '').replace(/\d+/g, '#').trim();
  if (message) return message.slice(0, 120);
  return check.failureCode || 'failed';
}

/** Failed checks grouped by kind and cause, largest first, with example ids. */
export function groupAuditFailures(checks) {
  const groups = new Map();
  for (const c of checks || []) {
    if (c.status !== 'fail') continue;
    const cause = failureCause(c);
    const key = `${c.kind}|${cause}`;
    const g = groups.get(key) || { kind: c.kind, cause, count: 0, maxMs: 0, examples: [] };
    g.count += 1;
    g.maxMs = Math.max(g.maxMs, Math.round(c.durationMs || 0));
    if (g.examples.length < 3) g.examples.push(c.id);
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

export function renderAuditFailureGroups(groups) {
  if (!groups.length) return [];
  const out = ['Failure causes:', '| count | kind | cause | slowest ms | examples |', '| ---: | --- | --- | ---: | --- |'];
  for (const g of groups.slice(0, 15)) out.push(`| ${g.count} | ${g.kind} | ${g.cause} | ${g.maxMs} | ${g.examples.join(', ')} |`);
  if (groups.length > 15) out.push(`| | | ${groups.length - 15} more causes | | |`);
  return out;
}
