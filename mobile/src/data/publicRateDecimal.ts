import { Decimal } from '../lib/productTermsEngine/decimal';
import type { PublicRateUnit } from './publicRateModel';

export { Decimal };
// Bounded immutable numeric atoms: repeated programme conditions and quoted
// rates must not repeat rational parsing/formatting for every offer and edit.
const atoms = new Map<string, Decimal>();
const rates = new Map<string, Decimal>();
const texts = new WeakMap<Decimal, string>();
export function publicDecimal(value: string): Decimal {
  const prior = atoms.get(value);
  if (prior) return prior;
  const parsed = Object.freeze(Decimal.parse(value));
  if (atoms.size >= 2048) atoms.delete(atoms.keys().next().value!);
  atoms.set(value, parsed);
  return parsed;
}
export const PUBLIC_ZERO = Decimal.parse('0');
export const PUBLIC_ONE = Decimal.parse('1');

/** No magnitude guessing. A percentage-point value of 6.2 always means .062. */
export function rateDecimal(value: string, unit: PublicRateUnit): Decimal {
  if (!['fraction_per_annum', 'percentage_points', 'basis_points'].includes(unit)) throw new Error('unsupported_rate_unit');
  if (typeof value !== 'string') throw new Error('invalid_decimal');
  const key = unit + ':' + value, prior = rates.get(key);
  if (prior) return prior;
  const parsed = publicDecimal(value);
  const rate = Object.freeze(unit === 'fraction_per_annum' ? parsed : parsed.div(publicDecimal(unit === 'percentage_points' ? '100' : '10000')));
  if (rates.size >= 2048) rates.delete(rates.keys().next().value!);
  rates.set(key, rate);
  return rate;
}

export function decimalText(value: Decimal): string {
  const prior = texts.get(value);
  if (prior !== undefined) return prior;
  const text = value.fixed(24, 'half_up').replace(/\.?0+$/, '') || '0';
  if (Object.isFrozen(value)) texts.set(value, text);
  return text;
}

export function finiteDecimal(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { publicDecimal(value); return true; } catch { return false; }
}

export function isRecurringDecimal(value: Decimal): boolean {
  let denominator = value.d;
  while (denominator % BigInt(2) === BigInt(0)) denominator /= BigInt(2);
  while (denominator % BigInt(5) === BigInt(0)) denominator /= BigInt(5);
  return denominator !== BigInt(1);
}
