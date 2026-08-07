import { FileSystem } from 'react-native-file-access';

type InFlightHash = {
  path: string;
  promise: Promise<string>;
};

let inFlightHash: InFlightHash | null = null;

const toNativePath = (path: string): string =>
  path.startsWith('file://') ? decodeURI(path.slice('file://'.length)) : path;

/** Compute a file digest off the JavaScript thread. */
export function hashFileSha256(path: string): Promise<string> {
  const nativePath = toNativePath(path);
  if (inFlightHash) {
    if (inFlightHash.path === nativePath) return inFlightHash.promise;
    return Promise.reject(new Error('Another APK sha256 verification is still in progress'));
  }

  const promise = FileSystem.hash(nativePath, 'SHA-256').finally(() => {
    if (inFlightHash?.promise === promise) inFlightHash = null;
  });
  inFlightHash = { path: nativePath, promise };
  return promise;
}
