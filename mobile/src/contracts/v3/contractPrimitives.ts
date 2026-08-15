import { sha256 } from '@noble/hashes/sha256';
import { utf8ToBytes } from '@noble/hashes/utils';

const HEX_256 = /^[0-9a-f]{64}$/;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const DECIMAL = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const NONNEGATIVE_DECIMAL = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;

export class V3ContractError extends Error {
  constructor(message: string) {
    super(`v3 contract rejected: ${message}`);
    this.name = 'V3ContractError';
  }
}

export function reject(message: string): never {
  throw new V3ContractError(message);
}

export function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    reject(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) reject(`${path}.${key} is required`);
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) reject(`${path}.${key} is not allowed`);
  }
}

export function text(value: unknown, path: string, options: { min?: number; max?: number } = {}): string {
  const min = options.min ?? 1;
  const max = options.max ?? 4096;
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    reject(`${path} must be a string between ${min} and ${max} characters`);
  }
  return value;
}

export function nullableText(value: unknown, path: string): string | null {
  return value === null ? null : text(value, path, { min: 0 });
}

export function integer(value: unknown, path: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    reject(`${path} must be a safe integer between ${minimum} and ${maximum}`);
  }
  return value as number;
}

export function booleanValue(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') reject(`${path} must be boolean`);
  return value;
}

export function digest(value: unknown, path: string): string {
  if (typeof value !== 'string' || !HEX_256.test(value)) {
    reject(`${path} must be a lowercase SHA-256`);
  }
  return value;
}

export function sha1Commit(value: unknown, path: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) {
    reject(`${path} must be a lowercase 40-character commit SHA`);
  }
  return value;
}

export function dateValue(value: unknown, path: string): string {
  if (typeof value !== 'string' || !YMD.test(value)) reject(`${path} must be YYYY-MM-DD`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    reject(`${path} is not a calendar date`);
  }
  return value;
}

export function instant(value: unknown, path: string): string {
  if (typeof value !== 'string' || !RFC3339.test(value) || !Number.isFinite(Date.parse(value))) {
    reject(`${path} must be an RFC3339 date-time`);
  }
  return value;
}

export function enumValue<T extends string>(value: unknown, allowed: readonly T[], path: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    reject(`${path} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

export function decimalString(value: unknown, path: string, nonnegative = false): string {
  const pattern = nonnegative ? NONNEGATIVE_DECIMAL : DECIMAL;
  if (typeof value !== 'string' || !pattern.test(value)) reject(`${path} must be a canonical decimal string`);
  return value;
}

export function fractionString(value: unknown, path: string): string {
  const raw = decimalString(value, path, true);
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1) {
    reject(`${path} must be a fraction between 0 and 1`);
  }
  return raw;
}

export function arrayValue(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) reject(`${path} must be an array`);
  return value;
}

export function uniqueStrings(
  value: unknown,
  path: string,
  validate: (value: unknown, path: string) => string = (item, itemPath) => text(item, itemPath),
  minimum = 0,
): string[] {
  const values = arrayValue(value, path).map((item, index) => validate(item, `${path}[${index}]`));
  if (values.length < minimum) reject(`${path} must contain at least ${minimum} item(s)`);
  if (new Set(values).size !== values.length) reject(`${path} must contain unique items`);
  return values;
}

export function httpsUrl(value: unknown, path: string): string {
  const raw = text(value, path, { max: 4096 });
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return reject(`${path} must be an absolute URL`);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !parsed.hostname) {
    reject(`${path} must be credential-free HTTPS`);
  }
  return raw;
}

export function releaseUrl(
  value: unknown,
  expectedDigest: string,
  path: string,
  allowedPaths: readonly string[],
): string {
  const raw = httpsUrl(value, path);
  const parsed = new URL(raw);
  if (
    parsed.hostname !== 'github.com' ||
    (parsed.port && parsed.port !== '443') ||
    parsed.search !== '' ||
    parsed.hash !== '' ||
    !allowedPaths.includes(parsed.pathname) ||
    !parsed.pathname.includes(expectedDigest)
  ) {
    reject(`${path} must be a content-addressed canonical AR-local release URL`);
  }
  return raw;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) reject('canonical JSON cannot contain non-finite numbers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`).join(',')}}`;
  }
  return reject('canonical JSON contains an unsupported value');
}

export function sha256Utf8(value: string): string {
  return sha256Bytes(utf8ToBytes(value));
}

export function sha256Bytes(value: Uint8Array): string {
  return Array.from(sha256(value))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function bytesToHex(value: Uint8Array): string {
  let result = '';
  for (const byte of value) result += byte.toString(16).padStart(2, '0');
  return result;
}

export function bytesFromHex(value: string, path: string): Uint8Array {
  if (value.length === 0 || value.length % 2 !== 0 || !/^[0-9a-f]+$/.test(value)) {
    reject(`${path} must be non-empty lowercase hexadecimal bytes`);
  }
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

export function utf8Hex(value: string): string {
  return bytesToHex(utf8ToBytes(value));
}

export function utf8Bytes(value: string): Uint8Array {
  return utf8ToBytes(value);
}

export function utf8ByteLength(value: string): number {
  return utf8ToBytes(value).byteLength;
}

export function canonicalSha256(value: unknown): string {
  return sha256Utf8(stableStringify(value));
}

export function sameCanonicalValue(left: unknown, right: unknown): boolean {
  return stableStringify(left) === stableStringify(right);
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
