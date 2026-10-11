import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

/** Hash the JSON representation, including every enumerable data field. */
export function jsonContentHash(value: object): string {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(value))));
}
