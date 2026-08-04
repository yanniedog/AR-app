import { loyaltyGapInsight } from '../src/data/decisionInsights';

describe('loyalty gap insight', () => {
  it('measures mortgage cost above an eligibility-matched best', () => {
    const insight = loyaltyGapInsight('Mortgage', 500_000, 0.06, 0.055, 0.057);
    expect(insight?.gapRate).toBeCloseTo(0.005);
    expect(insight?.monthlyDollars).toBeCloseTo(208.33, 2);
    expect(insight?.annualDollars).toBeCloseTo(2500);
    expect(insight?.typicalGapRate).toBeCloseTo(0.003);
  });

  it('measures missed deposit interest below the matched best', () => {
    const insight = loyaltyGapInsight('Savings', 100_000, 0.04, 0.05, 0.045);
    expect(insight?.gapRate).toBeCloseTo(0.01);
    expect(insight?.monthlyDollars).toBeCloseTo(83.33, 2);
    expect(insight?.annualDollars).toBeCloseTo(1000);
    expect(insight?.typicalGapRate).toBeCloseTo(0.005);
  });

  it('does not invent a negative gap when the user already has the better rate', () => {
    expect(loyaltyGapInsight('TD', 50_000, 0.055, 0.05, null)?.annualDollars).toBe(0);
  });
});
