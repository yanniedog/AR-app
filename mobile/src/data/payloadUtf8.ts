import { strFromU8 } from 'fflate';

/** Consistent strict UTF-8 on older runtimes without a fatal TextDecoder. */
export function decodePayloadUtf8(bytes: Uint8Array): string {
  for (let i = 0; i < bytes.length;) {
    const first = bytes[i++];
    if (first < 0x80) continue;
    const count = first >= 0xc2 && first <= 0xdf ? 1 : first >= 0xe0 && first <= 0xef ? 2 : first >= 0xf0 && first <= 0xf4 ? 3 : -1;
    if (count < 0 || i + count > bytes.length) throw new Error('Invalid payload UTF-8');
    const second = bytes[i];
    if ((first === 0xe0 && second < 0xa0) || (first === 0xed && second >= 0xa0) ||
        (first === 0xf0 && second < 0x90) || (first === 0xf4 && second >= 0x90)) throw new Error('Invalid payload UTF-8');
    for (let end = i + count; i < end; i++) if ((bytes[i] & 0xc0) !== 0x80) throw new Error('Invalid payload UTF-8');
  }
  return strFromU8(bytes);
}
