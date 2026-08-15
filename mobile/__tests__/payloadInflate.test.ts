import { gzipSync } from 'fflate';

import {
  BANK_SPREAD_MAX_COMPRESSED_BYTES,
  downloadBankSpreadHistory,
  gunzipCooperatively,
} from '../src/data/payload';
import { yieldToUi } from '../src/lib/yieldToUi';

jest.mock('../src/lib/yieldToUi', () => ({
  yieldToUi: jest.fn(async () => undefined),
}));

describe('cooperative payload inflate', () => {
  beforeEach(() => jest.mocked(yieldToUi).mockClear());

  it('preserves bytes while yielding between compressed chunks', async () => {
    const original = new Uint8Array(16_384);
    let state = 0x12345678;
    for (let index = 0; index < original.length; index += 1) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      original[index] = state & 0xff;
    }
    const compressed = gzipSync(original);
    const inflated = await gunzipCooperatively(compressed, 1_024);

    expect(inflated).toEqual(original);
    expect(jest.mocked(yieldToUi).mock.calls.length).toBeGreaterThan(0);
  });

  it('uses the synchronous path without yielding for a small payload', async () => {
    const original = new TextEncoder().encode('small payload');
    const compressed = gzipSync(original);

    await expect(gunzipCooperatively(compressed, 1_024)).resolves.toEqual(original);
    expect(yieldToUi).not.toHaveBeenCalled();
  });

  it('stops streaming inflate at the declared output ceiling', async () => {
    const original = new TextEncoder().encode('x'.repeat(64 * 1024));
    const compressed = gzipSync(original);

    await expect(gunzipCooperatively(compressed, 128, 1024)).rejects.toThrow(
      'inflated asset exceeds 1024 byte limit',
    );
  });

  it.each([
    undefined,
    null,
    0,
    -1,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    BANK_SPREAD_MAX_COMPRESSED_BYTES + 1,
  ])(
    'rejects an invalid exact compressed byte count before network activity (%p)',
    async (expectedBytes) => {
      const xhrBefore = globalThis.XMLHttpRequest;
      const xhrConstructor = jest.fn();
      Object.defineProperty(globalThis, 'XMLHttpRequest', {
        configurable: true,
        value: xhrConstructor,
      });
      try {
        await expect(downloadBankSpreadHistory(
          'https://example.test/bank-spread-history.json.gz',
          'a'.repeat(64),
          { expectedBytes: expectedBytes as number | undefined, requireExactBytes: true },
        )).rejects.toThrow(/positive safe-integer expectedBytes/);
        expect(xhrConstructor).not.toHaveBeenCalled();
      } finally {
        Object.defineProperty(globalThis, 'XMLHttpRequest', {
          configurable: true,
          value: xhrBefore,
        });
      }
    },
  );
});
