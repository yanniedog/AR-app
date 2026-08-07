import { FileSystem } from 'react-native-file-access';

import { hashFileSha256 } from '../src/lib/nativeFileHash';

describe('hashFileSha256', () => {
  beforeEach(() => {
    jest.mocked(FileSystem.hash).mockClear();
  });

  it('normalizes file URIs and reuses native work for the same path', async () => {
    let resolveHash!: (digest: string) => void;
    jest.mocked(FileSystem.hash).mockImplementationOnce(
      () => new Promise<string>((resolve) => { resolveHash = resolve; }),
    );

    const first = hashFileSha256('file:///docs/app%20update.apk');
    const repeated = hashFileSha256('file:///docs/app%20update.apk');

    expect(FileSystem.hash).toHaveBeenCalledTimes(1);
    expect(FileSystem.hash).toHaveBeenCalledWith('/docs/app update.apk', 'SHA-256');
    resolveHash('abc123');
    await expect(Promise.all([first, repeated])).resolves.toEqual(['abc123', 'abc123']);
  });

  it('refuses another path until the active native hash settles', async () => {
    let resolveHash!: (digest: string) => void;
    jest.mocked(FileSystem.hash).mockImplementationOnce(
      () => new Promise<string>((resolve) => { resolveHash = resolve; }),
    );

    const active = hashFileSha256('/docs/first.apk');
    await expect(hashFileSha256('/docs/second.apk')).rejects.toThrow(
      /another APK sha256 verification is still in progress/i,
    );
    expect(FileSystem.hash).toHaveBeenCalledTimes(1);

    resolveHash('first');
    await expect(active).resolves.toBe('first');
    jest.mocked(FileSystem.hash).mockResolvedValueOnce('second');
    await expect(hashFileSha256('/docs/second.apk')).resolves.toBe('second');
    expect(FileSystem.hash).toHaveBeenCalledTimes(2);
  });
});
