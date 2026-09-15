import { savingsHarness } from '../test-support/savingsMonetaryHarness';
import { downloadInflate } from '../src/data/payload';
import { assertSavingsSelection } from '../src/data/monetaryContracts/transport';
import { eligibilityBundleIdentity } from '../src/data/eligibilityContracts/transport';
jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn() }));
test('core mutation before capability load cannot acquire source authority', async () => {
  const h = await savingsHarness();
  h.context.core!.sections.Savings.rates.push({ product_key: h.target.productKey, rate_index: 7, rate: 0.03 } as any);
  (downloadInflate as jest.Mock).mockClear(); await expect(h.load()).rejects.toThrow('not verified');
  expect(downloadInflate).not.toHaveBeenCalled();
});
test('unsupported capability bodies are never downloaded', async () => {
  const h = await savingsHarness(), m = h.context.manifest;
  (m.executable_v3!.capabilities as any).mortgage_calculation = { index: { name: `monetary_v3_mortgage_calculation_index-${m.run_date}-${'d'.repeat(12)}.json.gz`, sha256: 'd'.repeat(64), bytes: 1 }, shards: {} };
  const bundle = eligibilityBundleIdentity(m); m.payload_revision!.bundle_sha256 = bundle; m.payload_revision!.generation_id = `sha256-${bundle}`;
  (downloadInflate as jest.Mock).mockClear(); await h.load();
  expect((downloadInflate as jest.Mock).mock.calls).toHaveLength(2);
  expect((downloadInflate as jest.Mock).mock.calls.every(call => call[0].includes('savings_calculation'))).toBe(true);
});
test('pending transport cannot adopt a mutated edition', async () => {
  const h = await savingsHarness(); let resolve!: (v: string) => void;
  (downloadInflate as jest.Mock).mockImplementationOnce(() => new Promise<string>(r => { resolve = r; }));
  const loading = h.load(); h.context.manifest.generated_at = '2026-09-15T03:00:00Z'; resolve(JSON.stringify(h.index));
  await expect(loading).rejects.toThrow();
});
test('mutated adopted core and substituted details cannot reuse a selection', async () => {
  const h = await savingsHarness(), [selection] = await h.load();
  const copy = { ...h.target, detail: { ...h.target.detail } };
  expect(() => assertSavingsSelection(selection, h.context, copy)).toThrow();
  h.context.core!.sections.Savings.rates.push({ product_key: h.target.productKey, rate_index: 7, rate: 0.03 } as any);
  expect(() => assertSavingsSelection(selection, h.context, h.target)).toThrow();
});
