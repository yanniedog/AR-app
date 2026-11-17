import { cache } from '../src/data/cache';

const mockFiles = new Map<string, Buffer>();
const mockLegacyWrite = jest.fn(async (path: string, text: string) => {
  mockFiles.set(path, Buffer.from(text));
});
const mockWriteChunk = jest.fn();
const mockClose = jest.fn();

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('expo-constants', () => ({ expoConfig: { extra: {} } }));
jest.mock('../src/lib/yieldToUi', () => ({ yieldToUi: async () => undefined }));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///app/',
  getInfoAsync: async () => ({ exists: true, isDirectory: true }),
  writeAsStringAsync: (...args: [string, string]) => mockLegacyWrite(...args),
  moveAsync: async ({ from, to }: { from: string; to: string }) => {
    mockFiles.set(to, mockFiles.get(from)!);
    mockFiles.delete(from);
  },
  deleteAsync: async (path: string) => { mockFiles.delete(path); },
}));
jest.mock('expo-file-system', () => ({
  File: class {
    constructor(private readonly mockPath: string) {}
    create() { mockFiles.set(this.mockPath, Buffer.alloc(0)); }
    open() {
      const path = this.mockPath;
      return {
        get offset() { return mockFiles.get(path)!.length; },
        writeBytes(bytes: Uint8Array) {
          mockWriteChunk(bytes);
          mockFiles.set(path, Buffer.concat([mockFiles.get(path)!, Buffer.from(bytes)]));
        },
        close: mockClose,
      };
    }
  },
}));

const detailsPath = 'file:///app/payload/details.json';
const chunk = 128 * 1024;
// Place a surrogate pair at the boundary of two file-system writes.
const details = 'a'.repeat(chunk - 1) + '\uD83D\uDCB0' + 'b'.repeat(1024 * 1024);

beforeEach(() => {
  mockFiles.clear();
  jest.clearAllMocks();
});

test('large Android details writes preserve UTF-8 and publish after the handle closes', async () => {
  await cache.writeDetails(details);
  expect(mockLegacyWrite).not.toHaveBeenCalled();
  expect(mockWriteChunk.mock.calls.length).toBeGreaterThan(1);
  expect(mockWriteChunk.mock.calls.every(([bytes]) => bytes.length <= 3 * chunk)).toBe(true);
  expect(mockClose).toHaveBeenCalledTimes(1);
  expect(mockFiles.get(detailsPath)).toEqual(Buffer.from(details));
  expect([...mockFiles.keys()]).toEqual([detailsPath]);
});

test('an interrupted large Android write closes the handle and preserves the installed data', async () => {
  mockFiles.set(detailsPath, Buffer.from('previous'));
  mockWriteChunk.mockImplementationOnce(() => undefined).mockImplementationOnce(() => {
    throw new Error('simulated write interruption');
  });
  await expect(cache.writeDetails(details)).rejects.toThrow('simulated write interruption');
  expect(mockLegacyWrite).not.toHaveBeenCalled();
  expect(mockClose).toHaveBeenCalledTimes(1);
  expect(mockFiles.get(detailsPath)?.toString()).toBe('previous');
  expect([...mockFiles.keys()]).toEqual([detailsPath]);
});
