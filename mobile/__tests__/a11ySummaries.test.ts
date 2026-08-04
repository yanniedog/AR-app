import {
  bankHistoryChartA11ySummary,
  rateValueLabel,
  rbaChartA11ySummary,
  rbaDecisionA11yLabel,
  ribbonA11ySummary,
} from '../src/lib/a11ySummaries';

describe('a11ySummaries', () => {
  const stats = {
    min: 0.0589,
    max: 0.0745,
    median: 0.0612,
    mean: 0.062,
    count: 842,
    providers: 67,
    products: 400,
  };

  it('builds actionable market-opportunity summary with RBA', () => {
    const s = ribbonA11ySummary(stats, 'Mortgage', 0.0435);
    expect(s).toContain('Home loans market opportunity');
    expect(s).toContain('best advertised 5.89%');
    expect(s).toContain('23 basis points between best and typical');
    expect(s).toContain('842 rates from 67 lenders');
    expect(s).toContain('RBA cash rate 4.35%');
  });

  it('builds RBA chart summary', () => {
    const s = rbaChartA11ySummary([
      { date: '2024-01-01', rate: 4.35 },
      { date: '2024-06-01', rate: 4.6 },
    ]);
    expect(s).toContain('RBA cash rate chart');
    expect(s).toContain('current 4.60 percent');
    expect(s).toContain('range 4.35 to 4.60 percent');
  });

  it('announces marked hold meetings', () => {
    const s = rbaChartA11ySummary([{ date: '2024-01-01', rate: 4.35 }], 2);
    expect(s).toContain('2 on-hold meetings marked');
  });

  it('builds bank history chart summary', () => {
    const s = bankHistoryChartA11ySummary({
      section: 'Mortgage',
      window: '30D',
      activeDate: '2024-06-01',
      activePoint: { date: '2024-06-01', min: 0.058, max: 0.062, mean: 0.06, median: 0.059 },
      showRba: true,
    });
    expect(s).toContain('Home loans history chart');
    expect(s).toContain('30D window');
    expect(s).toContain('mean 6.00%');
    expect(s).toContain('RBA cash rate overlay shown');
  });

  it('labels rate by section direction', () => {
    expect(rateValueLabel('Mortgage')).toBe('Interest rate');
    expect(rateValueLabel('Savings')).toBe('Rate');
    expect(rateValueLabel('Mortgage', 'best')).toBe('Best');
  });

  it('labels RBA decision direction', () => {
    expect(rbaDecisionA11yLabel(4.35, 4.6, 'Jun 2024')).toContain('Increased');
    expect(rbaDecisionA11yLabel(4.6, 4.35, 'Aug 2024')).toContain('Decreased');
  });
});
