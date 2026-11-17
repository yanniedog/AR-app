import { calculatorAmount, MAX_CALCULATOR_MORTGAGE_AMOUNT } from './calc';

/** The editable digits have an explicit thousands unit. Older saved values
 * without a suffix are still dollars and are converted only for display. */
export function mortgageMoneyDigits(value: string): string {
  const text = value.trim();
  if (/k$/i.test(text)) return text.replace(/^\$\s*/, '').slice(0, -1).trimEnd();
  const amount = calculatorAmount(text, MAX_CALCULATOR_MORTGAGE_AMOUNT);
  return amount === null ? text : String(Number((amount / 1_000).toFixed(5)));
}

/** Keep the unit on each saved edit, including intermediate decimal drafts. */
export function mortgageMoneyFromEdit(value: string): string {
  const text = value.trim();
  if (!text) return '';
  if (/k$/i.test(text)) {
    const digits = mortgageMoneyDigits(text);
    return digits ? `$${digits}k` : '';
  }
  // An explicit dollar amount pasted into the field already carries a unit.
  if (text.startsWith('$') && calculatorAmount(text, MAX_CALCULATOR_MORTGAGE_AMOUNT) !== null) return text;
  const digits = text.replace(/^\$\s*/, '');
  return digits ? `$${digits}k` : '';
}
