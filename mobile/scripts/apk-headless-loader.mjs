import { unzipSync } from 'fflate';

export const HEADLESS_LOADER = 'expo.modules.adapters.react.apploader.RNHeadlessAppLoader';
const DESCRIPTOR = `L${HEADLESS_LOADER.replaceAll('.', '/')};`;
const CONTEXT = 'Landroid/content/Context;';
const MAX_DEX_BYTES = 64 * 1024 * 1024;

/** Read class definitions, not string references: the manifest name survives
 * even when R8 removes/renames the reflected class. DEX layout specification:
 * https://source.android.com/docs/core/runtime/dex-format
 * This is a narrow release-contract check, not a general DEX verifier. */
function readDex(bytes) {
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
  return { dex, range, u16, u32, strings, types, protos, methods, classes, uleb, string, type };
}

export function inspectHeadlessLoaderDex(bytes) {
  const { range, u16, u32, protos, methods, classes, uleb, string, type } = readDex(bytes);
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
function readApkDexFiles(apk) {
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
  return files;
}

export function verifyApkHeadlessLoader(apk) {
  const definitions = Object.entries(readApkDexFiles(apk))
    .map(([name, bytes]) => ({ name, ...inspectHeadlessLoaderDex(bytes) }))
    .filter(result => result.defined);
  if (definitions.length !== 1) throw new Error(`APK must define exactly one ${HEADLESS_LOADER}; found ${definitions.length}`);
  if (!definitions[0].constructible) throw new Error(`APK is missing public ${HEADLESS_LOADER}(android.content.Context)`);
  return { className: HEADLESS_LOADER, dex: definitions[0].name, publicContextConstructor: true };
}

export const COLD_BACKGROUND_PATCH_MARKERS = [
  'AR_BACKGROUND_COLD_LOADER_UI_V1',
  'AR_BACKGROUND_RESTORE_KEEP_V1',
];

// Decode instruction boundaries so marker text in a DEX string table, an
// instruction operand, or switch/array data alone cannot satisfy the gate.
function instructionWidth(unit, offset, u16, u32) {
  const opcode = unit & 255;
  if (opcode === 0) {
    if (unit === 0) return 1;
    if (unit === 0x100) return 4 + 2 * u16(offset + 2);
    if (unit === 0x200) return 2 + 4 * u16(offset + 2);
    if (unit === 0x300) return 4 + Math.ceil(u16(offset + 2) * u32(offset + 4) / 2);
    throw new Error('Unsupported DEX instruction payload');
  }
  if ([1, 4, 7, 0x1d, 0x1e, 0x21, 0x27, 0x28].includes(opcode)
    || (opcode >= 0x0a && opcode <= 0x12) || (opcode >= 0x7b && opcode <= 0x8f)
    || (opcode >= 0xb0 && opcode <= 0xcf)) return 1;
  if ([2, 5, 8, 0x13, 0x15, 0x16, 0x19, 0x1a, 0x1c, 0x1f, 0x20, 0x22, 0x23, 0x29, 0xfe, 0xff].includes(opcode)
    || (opcode >= 0x2d && opcode <= 0x3d) || (opcode >= 0x44 && opcode <= 0x6d)
    || (opcode >= 0x90 && opcode <= 0xaf) || (opcode >= 0xd0 && opcode <= 0xe2)) return 2;
  if ([3, 6, 9, 0x14, 0x17, 0x1b, 0x24, 0x25, 0x26, 0x2a, 0x2b, 0x2c, 0xfc, 0xfd].includes(opcode)
    || (opcode >= 0x6e && opcode <= 0x72) || (opcode >= 0x74 && opcode <= 0x78)) return 3;
  if (opcode === 0xfa || opcode === 0xfb) return 4;
  if (opcode === 0x18) return 5;
  throw new Error(`Unsupported DEX opcode ${opcode} in background patch verification`);
}

/** Require executable const-string instructions in defined native methods.
 * R8 can inline/rename the methods, so class names are intentionally irrelevant.
 * Pinned source tests verify policy/dispatch semantics; this gate proves the
 * compiled patches reached the APK instead of an unpatched prebuilt AAR. */
export function inspectColdBackgroundPatchesDex(bytes) {
  const { range, u16, u32, methods, classes, uleb, string } = readDex(bytes);
  const expected = new Map();
  for (let i = 0; i < u32(56); i++) {
    const value = string(i);
    if (COLD_BACKGROUND_PATCH_MARKERS.includes(value)) expected.set(i, value);
  }
  const found = new Set();
  if (!expected.size) return [];
  for (let i = 0; i < u32(96); i++) {
    const item = classes(i), classIndex = u32(item), classData = u32(item + 24);
    if (!classData) continue;
    const cursor = { offset: classData };
    const fields = uleb(cursor) + uleb(cursor);
    const groups = [uleb(cursor), uleb(cursor)];
    for (let f = 0; f < fields; f++) { uleb(cursor); uleb(cursor); }
    for (const count of groups) {
      let methodIndex = 0;
      for (let m = 0; m < count; m++) {
        methodIndex += uleb(cursor);
        const flags = uleb(cursor), code = uleb(cursor);
        if (u16(methods(methodIndex)) !== classIndex) throw new Error('Invalid DEX method owner');
        if (!code || (flags & 0x500)) continue;
        range(code, 16);
        const start = code + 16, end = start + u32(code + 12) * 2;
        range(start, end - start);
        for (let at = start; at < end;) {
          const unit = u16(at), opcode = unit & 255;
          const width = instructionWidth(unit, at, u16, u32);
          if (at + width * 2 > end) throw new Error('Truncated DEX instruction');
          if (opcode === 0x1a || opcode === 0x1b) {
            const index = opcode === 0x1a ? u16(at + 2) : u32(at + 2);
            if (expected.has(index)) found.add(expected.get(index));
          }
          at += width * 2;
        }
      }
    }
  }
  return [...found].sort();
}

export function verifyApkColdBackgroundPatches(apk) {
  const found = new Set(Object.values(readApkDexFiles(apk)).flatMap(inspectColdBackgroundPatchesDex));
  const missing = COLD_BACKGROUND_PATCH_MARKERS.filter(marker => !found.has(marker));
  if (missing.length) throw new Error(`APK is missing compiled cold background repairs: ${missing.join(', ')}`);
  return { compiledPatches: [...found].sort() };
}
