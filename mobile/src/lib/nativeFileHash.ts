import { FileSystem } from 'react-native-file-access';

/** Compute a file digest off the JavaScript thread. */
export function hashFileSha256(path: string): Promise<string> {
  return FileSystem.hash(path, 'SHA-256');
}
