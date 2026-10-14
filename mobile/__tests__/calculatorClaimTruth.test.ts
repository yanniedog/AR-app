import fs from 'node:fs';
import path from 'node:path';
import { estimateEnteredRate } from '../src/data/publicRateLocal';

const calculatorSource = fs.readFileSync(path.join(__dirname, '..', 'app', 'calculator.tsx'), 'utf8');

describe('quick calculator claim truth', () => {
  it('requires an explicit mortgage term and never reports a multiplied remaining-term saving', () => {
    expect(calculatorSource).toContain('Enter the years left on the loan.');
    expect(calculatorSource).toContain('initial contractual repayment difference, not a total saving');
    expect(calculatorSource).not.toContain('num(inputs.years) || 25');
    expect(calculatorSource).not.toContain('perMonth * comparisonMonths');
    expect(calculatorSource).not.toContain('over remaining term');
  });

  it('uses rate-only output when maturity or eligibility evidence is unavailable', () => {
    expect(calculatorSource).toContain('<AppText variant="body" weight="800">Rate only</AppText>');
    expect(calculatorSource).toContain('quickEstimateUnavailableReason(row, section)');
    expect(calculatorSource).toContain('shown only for a published maturity and a non-conditional rate');
  });

  it('shows explicit input bounds before producing candidate claims', () => {
    expect(calculatorSource).toContain('Property value must be a valid amount up to $100 million.');
    expect(calculatorSource).toContain('Current rate must be from 0% to 100%.');
    expect(calculatorSource).toContain("if (!comparisonsReady || inputIssueKey || currentRate === null || balance <= 0");
  });

  it('distinguishes an explicit zero rate from missing inputs and rejects values outside the percentage bounds', () => {
    expect(estimateEnteredRate('0')).toMatchObject({ status: 'exact', payableRate: '0', origin: 'user_entered' });
    expect(estimateEnteredRate('100')).toMatchObject({ status: 'exact', payableRate: '1' });
    for (const value of ['', '-0.01', '100.01']) {
      const rate = estimateEnteredRate(value);
      expect(rate.status).toBe('unresolved'); expect(rate.payableRate).toBeUndefined();
    }
  });
});
