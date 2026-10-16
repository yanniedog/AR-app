import fs from 'node:fs';
import path from 'node:path';
import { estimateEnteredRate } from '../src/data/publicRateLocal';

const calculatorSource = fs.readFileSync(path.join(__dirname, '..', 'src/components/calculation/RateCheckWorkspace.tsx'), 'utf8');

describe('quick calculator claim truth', () => {
  it('requires an explicit mortgage term and never reports a multiplied remaining-term saving', () => {
    expect(calculatorSource).toContain("empty(CALCULATOR_FIELDS.years, uiJoin('Years remaining',': ','Required'))");
    expect(calculatorSource).toContain('Initial repayment');
    expect(calculatorSource).not.toContain('num(inputs.years) || 25');
    expect(calculatorSource).not.toContain('perMonth * comparisonMonths');
    expect(calculatorSource).not.toContain('over remaining term');
  });

  it('uses rate-only output when maturity or eligibility evidence is unavailable', () => {
    expect(calculatorSource).toContain('uiLabel("Rate only")');
    expect(calculatorSource).toContain('quickEstimateUnavailableReason(row, section)');
    expect(calculatorSource).toContain('Published maturity · Non-conditional rate');
    expect(calculatorSource).toContain('Maturity unpublished');
  });

  it('shows explicit input bounds before producing candidate claims', () => {
    expect(calculatorSource).toContain("uiJoin('Property value',': ',uiMoney(0),'–',uiMoney(MAX_CALCULATOR_MORTGAGE_AMOUNT))");
    expect(calculatorSource).toContain("uiJoin('Current rate',': ',0,'–',100,'%')");
    expect(calculatorSource).toContain("if (!comparisonsReady || inputIssueKey || currentRate === null || balance <= 0");
  });
  it('keeps zero as an explicit entered rate and rejects missing or out-of-range input', () => {
    expect(estimateEnteredRate('0')).toMatchObject({ status: 'exact', payableRate: '0', origin: 'user_entered' });
    expect(estimateEnteredRate('100')).toMatchObject({ status: 'exact', payableRate: '1' });
    for (const value of ['', '-0.01', '100.01']) expect(estimateEnteredRate(value)).toMatchObject({ status: 'unresolved' });
  });
});
