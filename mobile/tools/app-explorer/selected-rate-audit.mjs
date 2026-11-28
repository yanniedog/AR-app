// Verify the running APK against ANZ's public product disclosure. A missing
// offer, rate, or conditions panel cannot turn an unexercised check green.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = 'explorer-out/anz-selected-rate';
fs.mkdirSync(out, { recursive: true });
const id = '2d41a5d3-0c8d-d5e9-cadc-195410627e08';
// curl retries transient transport/HTTP failures. An unavailable live
// source must not be reported as a successful current-rate verification.
const disclosure = execFileSync('curl', ['--fail', '--silent', '--show-error', '--retry', '2',
  '--max-time', '30', '--header', 'x-v: 7', '--header', 'Accept: application/json',
  'https://api.anz/cds-au/v1/banking/products/' + id], { encoding: 'utf8' });
const { data } = JSON.parse(disclosure);
const matches = data.depositRates.map((row, index) => ({ row, index }))
  .filter(({ row }) => row.additionalInfo === '2-3 Months, Monthly Interest');
assert.equal(matches.length, 1, 'ANZ two-month monthly offer must be uniquely identified');
const { row, index } = matches[0];
const expected = (Number(row.rate) * 100).toFixed(2) + '%';
const key = ['ANZ', id, 'TERM_DEPOSITS', data.name].join('|');
const script = [{ launch: true }, { open: '/product/' + encodeURIComponent(key) + '?ri=' + (index + 1) },
  { waitFor: { text: expected }, timeout: 20000, name: 'offer' },
  { scroll: 'down', times: 1, name: 'terms' }];
const file = path.join(out, 'journey.json');
fs.writeFileSync(file, JSON.stringify(script));
execFileSync('node', [path.join(here, 'driver.mjs'), '--mode', 'script', '--script', file, '--out', out], { stdio: 'inherit' });
const { steps } = JSON.parse(fs.readFileSync(path.join(out, 'report.json')));
const labels = name => {
  const step = steps.find(s => s.name === name);
  assert.ok(step?.alive && !step.error, name + ' was not captured');
  const { nodes } = JSON.parse(fs.readFileSync(path.join(out, 'ui', step.slug + '.nodes.json')));
  return nodes.filter(n => n.pkg === 'com.eyex.australianrates').flatMap(n => [n.text, n.desc]).filter(Boolean);
};
const offer = labels('offer'), facts = [...offer, ...labels('terms')];
for (const text of [data.name, expected]) assert.ok(offer.includes(text), 'Missing selected offer field ' + text);
for (const text of ['2 mo', 'Monthly']) assert.ok(facts.includes(text), 'Missing selected term field ' + text);
// This selection discloses no balance bounds in AR's 28 November edition.
if (data.lastUpdated === '2026-09-23T14:01:00.000Z' || (facts.includes('Unknown') && facts.includes('Balance'))) {
  assert.ok(!offer.some(label => /[↑↓].*bps/i.test(label)), 'Unknown balance tier has a change badge');
}
for (const label of offer.filter(s => /[↑↓].*bps/i.test(s))) {
  assert.ok(!/Best advertised/i.test(label) && label.endsWith('→ ' + expected), 'Unmatched rate change: ' + label);
}
fs.writeFileSync(path.join(out, 'verified.json'), JSON.stringify({ product: data.name, offer: row, expected, labels: offer }));
