import { gzipSync } from 'fflate';

import { gunzipCooperatively } from '../src/data/payload';
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
});
