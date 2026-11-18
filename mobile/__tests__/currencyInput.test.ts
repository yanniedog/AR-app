import { currencyAmount, currencyDigits } from '../src/data/currencyInput';
import { uiPercentage, uiRate } from '../src/lib/uiCopy';

test('amount units preserve exact dollar values and legacy dollars', () => {
  expect(currencyAmount('750', 'K')).toBe('750000');
  expect(currencyAmount('0.75', 'M')).toBe('750000');
  expect(currencyAmount('$750,000', 'K')).toBe('750000');
  expect(currencyAmount('750K', '$')).toBe('750000');
  expect(currencyDigits('750000', 'K')).toBe('750');
  expect(currencyDigits('750000', 'M')).toBe('0.75');
  expect(currencyDigits('775', 'K')).toBe('0.775');
  expect(currencyAmount('0.000001', 'M')).toBe('1');
  expect(currencyAmount('0.00001', 'K')).toBe('0.01');
  expect(currencyDigits('123456789.12', 'M')).toBe('123.45678912');
});

test('invalid drafts do not become valid amounts, and zero stays distinct from blank', () => {
  for (const value of ['-1', '1e3', '1.2.3', '12,34', 'unknown', '.']) expect(currencyAmount(value, 'K')).toBeNull();
  expect(currencyAmount('', 'K')).toBe('');
  expect(currencyAmount('0', 'K')).toBe('0');
  expect(currencyAmount('775.', 'K')).toBe('775000');
});

test('percentages round display to three significant figures only', () => {
  expect(uiRate(0.1172)).toBe('11.7%');
  expect(uiRate(0.0674, 4)).toBe('6.74%');
  expect(uiRate(0.06)).toBe('6.00%');
  expect(uiRate(0)).toBe('0%');
  expect(uiPercentage(650 / 775 * 100)).toBe('83.9%');
  expect(uiPercentage(0.012345)).toBe('0.0123%');
});
