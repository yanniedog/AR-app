export type CurrencyUnit = 'K' | 'M' | '$';
const scales: Record<CurrencyUnit, number> = { K: 3, M: 6, $: 0 };

/** Shift decimal digits exactly; amounts never pass through binary floating point. */
function shift(value: string, places: number): string {
  const [whole, fraction = ''] = value.split('.');
  const digits = whole + fraction;
  const point = whole.length + places;
  const expanded = point <= 0 ? `0.${'0'.repeat(-point)}${digits}`
    : point >= digits.length ? digits + '0'.repeat(point - digits.length)
      : `${digits.slice(0, point)}.${digits.slice(point)}`;
  const [integer, decimal = ''] = expanded.split('.');
  const tail = decimal.replace(/0+$/, '');
  return `${integer.replace(/^0+(?=\d)/, '') || '0'}${tail ? `.${tail}` : ''}`;
}

export function currencyAmount(value: string, unit: CurrencyUnit = '$'): string | null {
  const text = value.trim();
  if (!text) return '';
  const match = text.match(/^(\$)?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)\s*([kKmM])?$/);
  if (!match) return null;
  const suffix = match[3]?.toUpperCase();
  const selected = suffix === 'K' ? 'K' : suffix === 'M' ? 'M' : (match[1] ? '$' : unit);
  const numeric = match[2].replace(/,/g, '').replace(/^\./, '0.').replace(/\.$/, '');
  if (numeric.length > 48) return null;
  return shift(numeric, scales[selected]);
}

export function currencyDigits(value: string, unit: CurrencyUnit): string {
  const dollars = currencyAmount(value);
  if (dollars === null || dollars === '') return value;
  const digits = shift(dollars, -scales[unit]);
  if (unit !== '$') return digits;
  const [whole, fraction] = digits.split('.');
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? `.${fraction}` : '');
}
