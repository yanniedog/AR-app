import type { DetailItem, FeeDiscount } from '../types';
import { formatRate, humanizeEnum } from './format';

function finiteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(String(value).replace(/[$,\s]/g, ''));
  return Number.isFinite(number) ? number : null;
}

function money(value: unknown, currency?: string): string | null {
  const amount = finiteNumber(value);
  if (amount === null) return null;
  const code = String(currency || 'AUD').toUpperCase();
  const formatted = amount.toLocaleString('en-AU', { maximumFractionDigits: 2 });
  return code === 'AUD' ? `$${formatted}` : `${code} $${formatted}`;
}

function cadence(value: unknown): string | null {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!raw) return null;
  const known: Record<string, string> = {
    P1D: 'daily',
    P1W: 'weekly',
    P2W: 'fortnightly',
    P1M: 'monthly',
    P3M: 'quarterly',
    P6M: 'half-yearly',
    P1Y: 'yearly',
  };
  if (known[raw]) return known[raw];
  const match = /^P(\d+)([DWMY])$/.exec(raw);
  if (!match) return humanizeEnum(raw);
  const unit = { D: 'day', W: 'week', M: 'month', Y: 'year' }[match[2]];
  return `every ${match[1]} ${unit}${match[1] === '1' ? '' : 's'}`;
}

function rateLabel(rate: unknown, kind?: string): string | null {
  if (finiteNumber(rate) === null) return null;
  const suffix: Record<string, string> = {
    BALANCE: 'of balance',
    TRANSACTION: 'of transaction',
    ACCRUED: 'of accrued amount',
  };
  const normalizedKind = String(kind ?? '').toUpperCase();
  return `${formatRate(rate as string | number)}${suffix[normalizedKind] ? ` ${suffix[normalizedKind]}` : ''}`;
}

function variableRange(item: DetailItem): string | null {
  const minimum = money(item.variable?.feeMinimum, item.currency);
  const maximum = money(item.variable?.feeMaximum, item.currency);
  if (minimum && maximum) return `${minimum}–${maximum}`;
  if (minimum) return `From ${minimum}`;
  if (maximum) return `Up to ${maximum}`;
  return null;
}

/** Concise, truthful fee value for both generations of the Australian CDR schema. */
export function formatFeeValue(item: DetailItem): string {
  const feeType = String(item.label ?? '').toUpperCase();
  const method = String(item.feeMethodUType ?? '').toLowerCase();
  const amountStatus = item.amountStatus?.trim().toLowerCase();
  const isVariable = amountStatus === 'variable' || method === 'variable' || feeType === 'VARIABLE';
  if (isVariable) return variableRange(item) ?? 'Amount not published';

  const rate = item.rateBased?.rate ?? item.balanceRate ?? item.transactionRate ?? item.accruedRate;
  const rateKind = item.rateBased?.rateType
    ?? (item.balanceRate !== undefined ? 'BALANCE' : undefined)
    ?? (item.transactionRate !== undefined ? 'TRANSACTION' : undefined)
    ?? (item.accruedRate !== undefined ? 'ACCRUED' : undefined);
  const rateValue = rateLabel(rate, rateKind);
  if (rateValue) {
    const period = cadence(item.rateBased?.accrualFrequency ?? item.accrualFrequency);
    return period ? `${rateValue}, ${period}` : rateValue;
  }

  if (amountStatus && amountStatus !== 'fixed') return 'Amount not published';

  const fixed = money(item.amount ?? item.fixedAmount?.amount, item.currency);
  if (fixed) {
    const period = cadence(item.additionalValue ?? item.accrualFrequency);
    return period ? `${fixed} ${period}` : fixed;
  }

  if (item.value !== undefined && item.value !== null && String(item.value).trim()) {
    const raw = String(item.value).trim();
    const legacyAmount = money(raw, item.currency);
    if (legacyAmount && /^\s*\$?\s*\d[\d,]*(?:\.\d+)?\s*$/.test(raw)) return legacyAmount;
    return raw;
  }
  return 'Amount not published';
}

export function feeCapLabel(item: DetailItem): string | null {
  const cap = money(item.feeCap, item.currency);
  if (!cap) return null;
  const period = cadence(item.feeCapPeriod);
  return period ? `Cap ${cap} per ${period.replace(/^every /, '')}` : `Cap ${cap}`;
}

export function feeDiscountLabel(discount: FeeDiscount): string | null {
  const name = String(discount.description ?? '').trim();
  const note = String(discount.additionalInfo ?? '').trim();
  const fixed = money(discount.amount ?? discount.fixedAmount?.amount);
  const rate = rateLabel(
    discount.rateBased?.rate ?? discount.feeRate ?? discount.balanceRate ?? discount.transactionRate ?? discount.accruedRate,
    discount.rateBased?.rateType
      ?? (discount.balanceRate !== undefined ? 'BALANCE' : undefined)
      ?? (discount.transactionRate !== undefined ? 'TRANSACTION' : undefined),
  );
  const value = fixed ?? rate;
  const detail = [name, value, note].filter(Boolean).join(' · ');
  return detail || null;
}
