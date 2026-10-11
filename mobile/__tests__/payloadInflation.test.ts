import { gzipSync, strToU8 } from 'fflate';
import { Platform } from 'react-native';
import { getNativeHistoryCodec } from '../modules/history-codec';
import { decodePayloadUtf8, inflatePayloadOffThread, inflatePayloadOnWeb } from '../src/data/payloadInflation';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('../modules/history-codec', () => ({ getNativeHistoryCodec: jest.fn() }));
const getCodec = jest.mocked(getNativeHistoryCodec);

afterEach(() => { jest.resetAllMocks(); Object.assign(Platform, { OS: 'android' }); });

it('passes verified bytes and exact limits to the background native codec', async () => {
  const inflatePayloadAsync = jest.fn().mockResolvedValue(['{"ready":', 'true}']);
  getCodec.mockReturnValue({ inflatePayloadAsync } as unknown as ReturnType<typeof getNativeHistoryCodec>);
  const bytes = gzipSync(strToU8('{"ready":true}'));
  await expect(inflatePayloadOffThread(bytes, 100, 14)).resolves.toBe('{"ready":true}');
  expect(inflatePayloadAsync).toHaveBeenCalledWith(bytes, 100, 14);
  await inflatePayloadOffThread(bytes, 100);
  expect(inflatePayloadAsync).toHaveBeenLastCalledWith(bytes, 100, -1);
});

it('never masks a supported codec validation failure with a portable retry', async () => {
  const error = new Error('CRC mismatch');
  getCodec.mockReturnValue({ inflatePayloadAsync: jest.fn().mockRejectedValue(error) } as unknown as ReturnType<typeof getNativeHistoryCodec>);
  await expect(inflatePayloadOffThread(new Uint8Array(20), 100)).rejects.toBe(error);
});

it('retains portable fallback only when the platform capability is absent', async () => {
  getCodec.mockReturnValue(null);
  await expect(inflatePayloadOffThread(new Uint8Array(20), 100)).resolves.toBeNull();
  getCodec.mockReturnValue({} as ReturnType<typeof getNativeHistoryCodec>);
  await expect(inflatePayloadOffThread(new Uint8Array(20), 100)).resolves.toBeNull();
  Object.assign(Platform, { OS: 'ios' });
  await expect(inflatePayloadOffThread(new Uint8Array(20), 100)).resolves.toBeNull();
});

it.each([0, -1, 1.5, NaN, Infinity, 192 * 1024 * 1024 + 1])('rejects invalid output cap %s before native work', async limit => {
  await expect(inflatePayloadOffThread(new Uint8Array(20), limit)).rejects.toThrow('bounds');
  expect(getCodec).not.toHaveBeenCalled();
});

it('preserves valid Unicode and rejects noncanonical or truncated UTF-8', () => {
  const text = 'Crédit 😀 日本語 \u0000';
  expect(decodePayloadUtf8(strToU8(text))).toBe(text);
  for (const bytes of [[0x80], [0xc0, 0xaf], [0xe0, 0x80, 0x80], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xf0, 0x90], [0xc2, 0x41]]) {
    expect(() => decodePayloadUtf8(new Uint8Array(bytes))).toThrow('UTF-8');
  }
});

it('uses browser gzip with bounded output, CRC and strict UTF-8 checks', async () => {
  const names = ['Blob', 'DecompressionStream', 'TextDecoder'] as const;
  const saved = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  // Node's standard implementations exercise the same browser stream contract.
  Object.assign(globalThis, {
    Blob: jest.requireActual('node:buffer').Blob,
    DecompressionStream: jest.requireActual('node:stream/web').DecompressionStream,
    TextDecoder: jest.requireActual('node:util').TextDecoder,
  });
  try {
    const text = 'large Unicode 😀 '.repeat(10_000), bytes = strToU8(text), gzip = gzipSync(bytes);
    await expect(inflatePayloadOnWeb(gzip, bytes.length, bytes.length)).resolves.toBe(text);
    await expect(inflatePayloadOnWeb(gzip, bytes.length - 1)).rejects.toThrow('limit');
    await expect(inflatePayloadOnWeb(gzip, bytes.length + 1, bytes.length + 1)).rejects.toThrow('size mismatch');
    const badCrc = gzip.slice(); badCrc[badCrc.length - 8] ^= 1;
    await expect(inflatePayloadOnWeb(badCrc, bytes.length)).rejects.toThrow();
    await expect(inflatePayloadOnWeb(gzipSync(new Uint8Array([0xc0, 0xaf])), 100)).rejects.toThrow();
  } finally {
    names.forEach((name, index) => {
      const descriptor = saved[index];
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    });
  }
});
