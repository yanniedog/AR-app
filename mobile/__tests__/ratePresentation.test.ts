import { ratePresentation } from '../src/data/ratePresentation';
import type { RateRow } from '../src/types';

const mortgage = {
  provider: 'Bank',
  product_key: 'loan',
  product_name: 'Loan',
  rate: '0.0599',
  comparison_rate: '0.0633',
} as RateRow;

describe('ratePresentation', () => {
  it('highlights comparison rate and demotes advertised rate by default', () => {
    expect(ratePresentation(mortgage, 'Mortgage')).toEqual({
      primary: 0.0633,
      primaryLabel: 'Comparison rate',
      secondary: 0.0599,
      secondaryLabel: 'Advertised rate',
    });
  });

  it('honours an explicit advertised-rate preference', () => {
    expect(ratePresentation(mortgage, 'Mortgage', 'headline')).toEqual({
      primary: 0.0599,
      primaryLabel: 'Advertised rate',
      secondary: 0.0633,
      secondaryLabel: 'Comparison rate',
    });
  });

  it('falls back honestly when a bank does not publish comparison rate', () => {
    expect(ratePresentation({ ...mortgage, comparison_rate: undefined }, 'Mortgage')).toEqual({
      primary: 0.0599,
      primaryLabel: 'Advertised rate',
      secondary: null,
      secondaryLabel: null,
    });
  });
});
