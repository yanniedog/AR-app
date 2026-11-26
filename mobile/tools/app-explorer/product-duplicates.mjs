// Work from the captured Android viewport. A product disclosure can be captured
// repeatedly while scrolling or opening the next disclosure.
const DISCLOSURE = /^Hide (Fees|Eligibility|Features|Constraints|Product facts)$/;
const FACT_KIND = /^(Rates|Tiers|Eligibility|Constraints|Fees|Features|Conditions|Bundles|Attributes)$/;
const APP = 'com.eyex.australianrates';

export function visibleProductDuplicates(screens) {
  const groups = new Map();
  let captures = 0, rowsObserved = 0;
  for (const { nodes, name, slug } of screens) {
    if (!nodes.some(n => n.desc === 'Share' && n.pkg === APP)) continue;
    const viewport = nodes.find(n => n.pkg === APP && n.cls === 'ScrollView' && n.scrollable)?.bounds;
    const title = nodes.find(n => n.pkg === APP && n.text && viewport && n.bounds[3] <= viewport[1])?.text;
    if (!title || !viewport) continue;
    const visible = nodes.filter(n => n.pkg === APP && (n.text || n.desc) && n.bounds[1] >= viewport[1]
      && n.bounds[3] <= viewport[3] && n.bounds[2] > n.bounds[0] && n.bounds[3] > n.bounds[1]);
    // A scroll can start halfway through a group with its heading above the screen.
    let section = /^scroll product\b/.test(name) ? 'Heading off screen' : '';
    let kind = '', pending = null, observed = 0;
    const counts = new Map();
    function finish() {
      if (!pending) return;
      const key = JSON.stringify([title, ...pending]);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      if (count > 1 && count > (groups.get(key)?.occurrences ?? 0)) {
        groups.set(key, { product: title, section, kind, row: pending, occurrences: count, screen: name, slug });
      }
      observed++;
      pending = null;
    }
    for (let i = 0; i < visible.length; i++) {
      const n = visible[i];
      if (/^(Show|Hide) /.test(n.desc)) {
        finish();
        counts.clear();
        section = DISCLOSURE.exec(n.desc)?.[1] ?? '';
        kind = '';
        continue;
      }
      if (!section || n.text === section && !pending) continue;
      const next = visible[i + 1];
      // PublishedFacts uses two equally wide text columns aligned at their top.
      const [left, top, right] = n.bounds;
      if (n.cls === 'TextView' && n.text && next?.cls === 'TextView' && next.text
        && top === next.bounds[1] && right < next.bounds[0]
        && Math.abs((right - left) - (next.bounds[2] - next.bounds[0])) <= 1) {
        finish();
        if (top > viewport[1] && Math.max(n.bounds[3], next.bounds[3]) < viewport[3]) pending = [n.text, next.text];
        i++;
      } else if (section === 'Product facts' && FACT_KIND.test(n.text)) {
        finish(); counts.clear(); kind = n.text;
      } else if (n.clickable || n.desc) {
        // A linked row has its own accessibility wrapper. Withhold ambiguous evidence.
        finish(); section = '';
      } else if (pending && n.cls === 'TextView' && n.text) {
        pending.push(n.text); // Include tiers, caps and discounts in row identity.
      }
    }
    // The last row may continue below the viewport; only count delimited rows.
    if (observed) { captures++; rowsObserved += observed; }
  }
  // Peak per product and complete row wording is a lower bound. A row seen again
  // in an overlapping capture or in a disclosure with a clipped heading counts once.
  const evidence = [...groups.values()];
  return { extraRows: captures ? evidence.reduce((n, group) => n + group.occurrences - 1, 0) : null,
    captures, rowObservations: rowsObserved, evidence };
}
