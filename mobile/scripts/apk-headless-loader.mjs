import { unzipSync } from 'fflate';

export const HEADLESS_LOADER = 'expo.modules.adapters.react.apploader.RNHeadlessAppLoader';
const DESCRIPTOR = `L${HEADLESS_LOADER.replaceAll('.', '/')};`;
const CONTEXT = 'Landroid/content/Context;';
const MAX_DEX_BYTES = 64 * 1024 * 1024;

/** Read class definitions, not string references: the manifest name survives
 * even when R8 removes/renames the reflected class. DEX layout specification:
 * https://source.android.com/docs/core/runtime/dex-format
 * This is a narrow release-contract check, not a general DEX verifier. */
export function inspectHeadlessLoaderDex(bytes) {
  const dex = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const range = (offset, length) => {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length)
      || offset < 0 || length < 0 || offset + length > dex.length) {
      throw new Error('Invalid DEX bounds while checking the background app loader');
    }
  };
  const u16 = offset => { range(offset, 2); return dex.readUInt16LE(offset); };
  const u32 = offset => { range(offset, 4); return dex.readUInt32LE(offset); };
  if (!/^dex\n0(?:35|37|38|39|40)\0$/.test(dex.subarray(0, 8).toString('ascii'))
    || u32(32) !== dex.length || u32(36) !== 112 || u32(40) !== 0x12345678) {
    throw new Error('Unsupported or invalid DEX header for background app loader verification');
  }
  const table = (sizeOffset, offsetOffset, width) => {
    const size = u32(sizeOffset), offset = u32(offsetOffset);
    range(offset, size * width);
    return index => {
      if (!Number.isInteger(index) || index < 0 || index >= size) throw new Error('Invalid DEX table index');
      return offset + index * width;
    };
  };
  const strings = table(56, 60, 4), types = table(64, 68, 4);
  const protos = table(72, 76, 12), methods = table(88, 92, 8);
  const classes = table(96, 100, 32);
  const uleb = cursor => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      range(cursor.offset, 1);
      const byte = dex[cursor.offset++];
      if (i === 4 && byte > 15) throw new Error('Invalid DEX unsigned LEB128');
      value += (byte & 127) * (2 ** (7 * i));
      if (!(byte & 128)) return value;
    }
    throw new Error('Invalid DEX unsigned LEB128');
  };
  const string = index => {
    const cursor = { offset: u32(strings(index)) };
    uleb(cursor); // UTF-16 length; compared names and descriptors below are ASCII.
    const end = dex.indexOf(0, cursor.offset);
    if (end < 0) throw new Error('Unterminated DEX string');
    return dex.subarray(cursor.offset, end).toString('utf8');
  };
  const type = index => string(u32(types(index)));
  for (let i = 0; i < u32(96); i++) {
    const item = classes(i), classIndex = u32(item);
    if (type(classIndex) !== DESCRIPTOR) continue;
    const access = u32(item + 4), classData = u32(item + 24);
    if (!(access & 1) || (access & 0x600) || !classData) return { defined: true, constructible: false };
    const cursor = { offset: classData };
    const staticFields = uleb(cursor), instanceFields = uleb(cursor);
    const directMethods = uleb(cursor);
    uleb(cursor); // Virtual methods cannot be constructors.
    for (let f = 0; f < staticFields + instanceFields; f++) { uleb(cursor); uleb(cursor); }
    let methodIndex = 0;
    for (let m = 0; m < directMethods; m++) {
      methodIndex += uleb(cursor);
      const flags = uleb(cursor), code = uleb(cursor), method = methods(methodIndex);
      if (u16(method) !== classIndex || string(u32(method + 4)) !== '<init>') continue;
      const proto = protos(u16(method + 2)), parameters = u32(proto + 8);
      if (type(u32(proto + 4)) !== 'V' || !parameters || u32(parameters) !== 1
        || type(u16(parameters + 4)) !== CONTEXT) continue;
      if (!(flags & 1) || !(flags & 0x10000) || (flags & 0x508) || !code) continue;
      range(code, 16);
      const instructionCount = u32(code + 12);
      range(code + 16, instructionCount * 2);
      return { defined: true, constructible: instructionCount > 0 };
    }
    return { defined: true, constructible: false };
  }
  return { defined: false, constructible: false };
}

/** Fail publication unless a public, concrete loader and its reflected public
 * Context constructor are present in the actual release APK's DEX tables. */
export function verifyApkHeadlessLoader(apk) {
  let totalBytes = 0;
  const names = new Set();
  const files = unzipSync(new Uint8Array(apk), { filter(entry) {
    if (!/^classes(?:[2-9]|[1-9]\d+)?\.dex$/.test(entry.name)) return false;
    if (names.has(entry.name)) throw new Error('Duplicate APK DEX entry');
    names.add(entry.name);
    totalBytes += entry.originalSize;
    if (entry.originalSize > MAX_DEX_BYTES || totalBytes > 4 * MAX_DEX_BYTES || names.size > 32) {
      throw new Error('APK DEX exceeds background loader verification limits');
    }
    return true;
  } });
  const definitions = Object.entries(files)
    .map(([name, bytes]) => ({ name, ...inspectHeadlessLoaderDex(bytes) }))
    .filter(result => result.defined);
  if (definitions.length !== 1) throw new Error(`APK must define exactly one ${HEADLESS_LOADER}; found ${definitions.length}`);
  if (!definitions[0].constructible) throw new Error(`APK is missing public ${HEADLESS_LOADER}(android.content.Context)`);
  return { className: HEADLESS_LOADER, dex: definitions[0].name, publicContextConstructor: true };
}
