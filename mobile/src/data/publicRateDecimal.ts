import { Decimal } from '../lib/productTermsEngine/decimal';
import type { PublicRateUnit } from './publicRateModel';

export { Decimal };
export const PUBLIC_ZERO = Decimal.parse('0');
export const PUBLIC_ONE = Decimal.parse('1');

/** No magnitude guessing. A percentage-point value of 6.2 always means .062. */
export function rateDecimal(value: string, unit: PublicRateUnit): Decimal {
  const parsed = Decimal.parse(value);
  if (unit === 'fraction_per_annum') return parsed;
  if (unit === 'percentage_points') return parsed.div(Decimal.parse('100'));
  if (unit === 'basis_points') return parsed.div(Decimal.parse('10000'));
  throw new Error('unsupported_rate_unit');
}

export function decimalText(value: Decimal): string {
  return value.fixed(24, 'half_up').replace(/\.?0+$/, '') || '0';
}

export function finiteDecimal(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try { Decimal.parse(value); return true; } catch { return false; }
}

export function isRecurringDecimal(value: Decimal): boolean {
  let denominator = value.d;
  while (denominator % BigInt(2) === BigInt(0)) denominator /= BigInt(2);
  while (denominator % BigInt(5) === BigInt(0)) denominator /= BigInt(5);
  return denominator !== BigInt(1);
}
