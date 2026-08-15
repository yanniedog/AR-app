import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('financial claim truth contracts', () => {
  it('keeps compact rate-position cards to observed percentage-point gaps', () => {
    const today = read('app/(tabs)/index.tsx');
    const myRates = read('app/(tabs)/watchlist.tsx');

    for (const source of [today, myRates]) {
      expect(source).toContain('percentage point gap');
      expect(source).not.toContain('loyaltyGapInsight');
      expect(source).not.toContain('monthlyDollars');
      expect(source).not.toContain('annualDollars');
      expect(source).not.toContain('About $');
    }
    expect(today).toContain('Matched to your filters');
    expect(today).toContain('observed {formatRunDate(core.run_date)}');
    expect(myRates).toContain('matched to your filters');
  });

  it('does not put simple personal dollar arithmetic on product detail', () => {
    const product = read('app/product/[key].tsx');

    expect(product).not.toContain('personalBrief?.illustration');
    expect(product).not.toContain('periodDifference');
    expect(product).not.toContain('monthlyDifference');
    expect(product).toContain('Full projections keep assumptions, unknown fees and unavailable results visible.');
  });

  it('labels only evidence-complete costs as illustrative and never as Save or Costs', () => {
    const chart = read('src/components/scenario/StaySwitchChart.tsx');
    const editor = read('src/components/scenario/SwitchCostEditor.tsx');

    expect(chart).toContain('Illustrative difference');
    expect(chart).toContain("? 'Unavailable'");
    expect(chart).toContain('Cost difference and break-even stay unavailable');
    expect(chart).not.toContain("'Save '");
    expect(chart).not.toContain("'Costs '");
    expect(editor).toContain("'Unknown'");
    expect(editor).toContain('Enter 0 only after confirming there is no charge.');
    expect(editor).not.toContain("placeholder=\"0\"");
  });
});
