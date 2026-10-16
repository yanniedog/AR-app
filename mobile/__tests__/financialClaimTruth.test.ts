import fs from 'node:fs';
import path from 'node:path';

const read = (relativePath: string) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

describe('financial claim truth contracts', () => {
  it('keeps compact rate-position cards to observed percentage-point gaps', () => {
    const today = read('src/components/rates/RatesWorkspace.tsx');
    const myRates = read('app/(tabs)/watchlist.tsx');

    for (const source of [today, myRates]) {
      expect(source).not.toContain('loyaltyGapInsight');
      expect(source).not.toContain('monthlyDollars');
      expect(source).not.toContain('annualDollars');
      expect(source).not.toContain('About $');
    }
    expect(read('app/matches.tsx')).toContain('<LegacyRatesRoute');
    expect(today).toContain('usePreparedSearchRows');
    expect(today).toContain('effectiveFilters');
    expect(myRates).toContain('percentage points');
    expect(myRates).toContain('Matched observed rate');
    expect(myRates).toContain('Match / gap basis');
  });

  it('does not put simple personal dollar arithmetic on product detail', () => {
    const product = read('app/product/[key].tsx');

    expect(product).not.toContain('personalBrief?.illustration');
    expect(product).not.toContain('periodDifference');
    expect(product).not.toContain('monthlyDifference');
    // Financial arithmetic stays in the scoped projection model; explanatory
    // paragraphs are not a correctness contract for the product surface.
    expect(product).toContain('projection={staySwitchProjection}');
    expect(product).toContain('staySwitchProjection?.ready');
  });

  it('labels only evidence-complete costs as illustrative and never as Save or Costs', () => {
    const chart = read('src/components/scenario/StaySwitchChart.tsx');
    const editor = read('src/components/scenario/SwitchCostEditor.tsx');

    expect(chart).toContain('Total-cost difference');
    expect(chart).toContain("projection.totalCostSaving == null ? uiLabel('Unavailable')");
    expect(chart).toContain('Eligibility unverified');
    expect(chart).toContain('Fees unverified');
    expect(chart).toContain('Monthly illustration');
    expect(chart).toContain('Known costs');
    expect(chart).not.toContain("'Save '");
    expect(chart).not.toContain("'Costs '");
    expect(editor).toContain("'Unknown'");
    expect(editor).toContain('Fees unverified');
    expect(editor).not.toContain("placeholder=\"0\"");
  });
});
