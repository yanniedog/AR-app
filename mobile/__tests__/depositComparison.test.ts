import * as fs from 'fs';
import * as path from 'path';
import { comparisonSetup, inputs, profile } from '../test-support/executableDepositHarness';
import { compareDeposits } from '../src/data/executableContracts/depositComparison';
import { downloadInflate } from '../src/data/payload';
import { annualRateFromPercent } from '../src/components/product/DepositInputFields';
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
function evidence(name: string, value: unknown) { const directory = process.env.AR_EXECUTABLE_BRIDGE_DIR; if (directory) { fs.mkdirSync(directory, { recursive: true }); fs.writeFileSync(path.join(directory, `actual-comparison-${name}.json`), JSON.stringify(value, null, 2) + '\n', 'utf8'); } }
beforeEach(() => (downloadInflate as jest.Mock).mockReset());
async function ready(change?: Parameters<typeof comparisonSetup>[0]) {
  const x = comparisonSetup(change), selected = await x.load();
  const alternatives = x.rows.map((row, i) => ({ id: String(i), row, selection: selected[i], inputs: { ...inputs, confirmedAnnualRate: selected[i].template.annualRate } }));
  return { ...x, alternatives };
}
test('independent leap-month oracle:2.90 versus5.80, advantage2.90; reverse reference and ties', async () => {
  const x = await ready(); const result = compareDeposits(x.context, x.alternatives, '0', profile);
  evidence('equal', result);
  expect(result.rankAvailable).toBe(true);
  expect(result.results.map(r => [r.data?.receipt.totals?.externalOutflows, r.advantage, r.rank])).toEqual([['1002.90', '0.00', 2], ['1005.80', '2.90', 1]]);
  const reverse = compareDeposits(x.context, x.alternatives, '1', profile);
  expect(reverse.results.map(r => r.advantage)).toEqual(['-2.90', '0.00']); expect(reverse.inputSha256).not.toBe(result.inputSha256);
  const tie = await ready(t => { t.annualRate = '0.0365'; });
  const tied = compareDeposits(tie.context, tie.alternatives, '0', profile); evidence('tie', tied);
  expect(tied.results.map(r => [r.rank, r.advantage])).toEqual([[1, '0.00'], [1, '0.00']]);
});
test('unequal valid maturities return independent results without ranking or holding policy', async () => {
  const x = await ready(t => { t.term.count = 2; }); x.alternatives[1].inputs.maturityDate = '2028-03-31';
  const r = compareDeposits(x.context, x.alternatives, '0', profile);
  evidence('unequal', r); expect(r.rankAvailable).toBe(false); expect(r.results.every(item => item.data?.receipt.claimAvailable)).toBe(true);
  expect(r.results.every(item => item.rank === null && item.advantage === null)).toBe(true); expect(r.reason).toContain('Separate results');
});
test('actual offer mismatch, missing approval and changed edition prevent ranking; inputs bind identity', async () => {
  const x = await ready(), before = compareDeposits(x.context, x.alternatives, '0', profile);
  x.alternatives[1].inputs.confirmedAnnualRate = '0.05';
  const changed = compareDeposits(x.context, x.alternatives, '0', profile);
  evidence('incomplete', changed); expect(changed.rankAvailable).toBe(false); expect(changed.results[1].error).toContain('bank-confirmed rate'); expect(changed.inputSha256).not.toBe(before.inputSha256);
  const missing = x.alternatives.map((a, i) => ({ ...a, selection: i ? null : a.selection }));
  expect(compareDeposits(x.context, missing, '0', profile).rankAvailable).toBe(false);
  const context = { ...x.context, manifest: { ...x.context.manifest!, tag: 'replacement' } };
  expect(compareDeposits(context, x.alternatives, '0', profile).results.every(r => r.data === null)).toBe(true);
});
test('same dates with different principals cannot rank and explicit false confirmation never means missing zero', async () => {
  const x = await ready(); x.alternatives[1].inputs.principal = '2000';
  expect(compareDeposits(x.context, x.alternatives, '0', profile).rankAvailable).toBe(false);
  x.alternatives[1].inputs.noWithholdingConfirmed = false;
  expect(compareDeposits(x.context, x.alternatives, '0', profile).results[1].data).toBeNull();
});
test('percent conversion uses exact decimals and rejects unsupported precision', () => {
  expect(annualRateFromPercent('3.65')).toBe('0.036500000000');
  expect(annualRateFromPercent('0')).toBe('0.000000000000');
  expect(() => annualRateFromPercent('3.650000000001')).toThrow();
});
