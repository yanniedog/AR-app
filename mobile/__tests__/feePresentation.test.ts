import { feeCapLabel, feeDiscountLabel, formatFeeValue } from '../src/data/feePresentation';

describe('fee presentation', () => {
  it('shows concrete amounts that AR-local receives from Greater Bank', () => {
    expect(formatFeeValue({ label: 'WITHDRAWAL', amountStatus: 'fixed', amount: '80.00' })).toBe('$80');
    expect(formatFeeValue({ label: 'EVENT', amountStatus: 'fixed', amount: '350.00' })).toBe('$350');
    expect(formatFeeValue({ label: 'TRANSACTION', amountStatus: 'fixed', amount: '0.00' })).toBe('$0');
  });

  it('does not misrepresent a variable zero placeholder as a free fee', () => {
    expect(formatFeeValue({ label: 'VARIABLE', amountStatus: 'variable', amount: '0.00' }))
      .toBe('Amount not published');
    expect(formatFeeValue({
      label: 'VARIABLE',
      amountStatus: 'variable',
      variable: { feeMinimum: '50', feeMaximum: '550' },
    })).toBe('$50–$550');
  });

  it('shows fee cadence, rate method, caps and discounts', () => {
    expect(formatFeeValue({ amount: '395', amountStatus: 'fixed', additionalValue: 'P1Y' }))
      .toBe('$395 yearly');
    expect(formatFeeValue({ amountStatus: 'rate', rateBased: { rateType: 'TRANSACTION', rate: '0.025' } }))
      .toBe('2.50% of transaction');
    expect(feeCapLabel({ feeCap: '500', feeCapPeriod: 'P90D' })).toBe('Cap $500 per 90 days');
    expect(feeDiscountLabel({ description: 'Shareholder', additionalInfo: 'Fee waived' }))
      .toBe('Shareholder · Fee waived');
  });

  it('labels missing fee pricing explicitly', () => {
    expect(formatFeeValue({ label: 'EVENT', name: 'Unpriced fee' })).toBe('Amount not published');
    expect(formatFeeValue({ label: 'EVENT', amountStatus: 'unpublished', amount: '0.00' }))
      .toBe('Amount not published');
    expect(formatFeeValue({ label: 'EVENT', amountStatus: 'rate', amount: '0.00' }))
      .toBe('Amount not published');
  });
});
