import fs from 'node:fs';
import path from 'node:path';

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
    expect(calculatorSource).toContain("uiJoin('Current rate',': ','>',0,'–',100,'%')");
    expect(calculatorSource).toContain("if (inputIssueKey || currentRate === null || balance <= 0");
  });
});
