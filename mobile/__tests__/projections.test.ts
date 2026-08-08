import {
  buildLifecycleProjection,
  MAX_PROJECTION_YEARS,
  metricValue,
  projectionMetricLabel,
} from '../src/data/projections';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';

const NOW = new Date('2026-08-04T10:00:00Z');

describe('lifecycle projections', () => {
  it('models mortgage rate and offset scenarios through payoff', () => {
    const scenario = normalizeUserRateScenario({
      mortgage: {
        mode: 'refi',
        loanBalance: '500000',
        currentRate: '6',
        years: '25',
      },
      projections: {
        mortgage: {
          periodicAmount: '3500',
          periodicFrequency: 'monthly',
          offsetBalance: '25000',
          offsetContributionAmount: '200',
          offsetContributionFrequency: 'weekly',
          offsetBoostAmount: '100',
          lowerRate: '5',
          higherRate: '7',
        },
      },
    });
    const result = buildLifecycleProjection('Mortgage', scenario, NOW);
    expect(result.ready).toBe(true);
    expect(result.rateSeries).toHaveLength(3);
    expect(result.offsetSeries).toHaveLength(3);
    expect(result.rateSeries[0].totalInterest).toBeLessThan(result.rateSeries[2].totalInterest);
    expect(result.offsetSeries[2].totalInterest).toBeLessThan(result.offsetSeries[1].totalInterest);
    expect(result.rateSeries[1].payoffDate).toMatch(/^20\d\d-\d\d-\d\d$/);
    expect(result.availableMetrics).toContain('cumulativeRatio');
  });

  it('adds an explicitly approximate historical segment and re-anchors future points to today', () => {
    const scenario = normalizeUserRateScenario({
      mortgage: { mode: 'refi', loanBalance: '460000', currentRate: '6.2', years: '22' },
      projections: {
        mortgage: {
          startDate: '2021-08-04',
          startBalance: '600000',
          startRate: '2.8',
          periodicAmount: '2800',
          periodicFrequency: 'monthly',
        },
      },
    });
    const result = buildLifecycleProjection('Mortgage', scenario, NOW);
    expect(result.history[0].date).toBe('2021-08-04');
    expect(result.history.at(-1)?.date).toBe('2026-08-04');
    expect(result.rateSeries[1].points[0].balance).toBe(460000);
    expect(result.assumptions.join(' ')).toMatch(/re-anchored/i);
    expect(result.warnings.join(' ')).toMatch(/approximate history/i);
  });

  it('models savings contributions, withdrawals and rate outcomes', () => {
    const scenario = normalizeUserRateScenario({
      savings: { balance: '20000', currentRate: '4.5' },
      projections: {
        savings: {
          horizonYears: '10',
          periodicAmount: '250',
          periodicFrequency: 'weekly',
          withdrawalAmount: '100',
          withdrawalFrequency: 'monthly',
          lowerRate: '3.5',
          higherRate: '5.5',
        },
      },
    });
    const result = buildLifecycleProjection('Savings', scenario, NOW);
    expect(result.ready).toBe(true);
    expect(result.rateSeries[2].endBalance).toBeGreaterThan(result.rateSeries[0].endBalance);
    expect(result.rateSeries[1].points).toHaveLength(121);
    expect(result.rateSeries[1].totalPrincipal).toBeGreaterThan(0);
    expect(metricValue(result.rateSeries[1].points.at(-1)!, 'cumulativeInterest')).toBeGreaterThan(0);
  });

  it('ends a term-deposit projection at maturity or the requested rollovers', () => {
    const scenario = normalizeUserRateScenario({
      termDeposit: { balance: '50000', currentRate: '4.8' },
      projections: {
        termDeposit: { termMonths: '12', rollovers: '2', reinvestInterest: true },
      },
    });
    const result = buildLifecycleProjection('TD', scenario, NOW);
    expect(result.ready).toBe(true);
    expect(result.rateSeries[1].points).toHaveLength(37);
    expect(result.rateSeries[1].endBalance).toBeGreaterThan(50000);
    expect(result.availableMetrics).toEqual(['balance', 'periodInterest', 'cumulativeInterest']);
  });

  it('stops a fixed mortgage at the known fixed period without inventing a reversion rate', () => {
    const scenario = normalizeUserRateScenario({
      mortgage: { mode: 'refi', loanBalance: '500000', currentRate: '6', years: '25' },
      projections: { mortgage: { mortgageRateStructure: 'fixed', fixedPeriodMonths: '24' } },
    });
    const result = buildLifecycleProjection('Mortgage', scenario, NOW);
    expect(result.ready).toBe(true);
    expect(result.projectionScope).toBe('fixed-period');
    expect(result.rateSeries[1].points).toHaveLength(25);
    expect(result.rateSeries[1].endBalance).toBeGreaterThan(0);
    expect(result.warnings.join(' ')).not.toMatch(/end of term/i);
    expect(result.assumptions.join(' ')).toMatch(/no unknown reversion rate/i);
  });

  it('models term-deposit maturity interest without savings-style monthly compounding', () => {
    const scenario = normalizeUserRateScenario({
      termDeposit: { balance: '50000', currentRate: '4.8' },
      projections: { termDeposit: { termMonths: '12', rollovers: '0', reinvestInterest: false } },
    });
    const result = buildLifecycleProjection('TD', scenario, NOW);
    expect(result.rateSeries[1].projectedInterest).toBeCloseTo(2400, 6);
    expect(result.rateSeries[1].endBalance).toBe(50000);
    expect(result.rateSeries[1].totalValue).toBeCloseTo(52400, 6);
    expect(result.rateSeries[0].totalValue).toBeCloseTo(52400, 6);
    expect(result.rateSeries[2].totalValue).toBeCloseTo(52400, 6);
  });

  it('uses rate scenarios only for term-deposit rollovers, not the contracted first term', () => {
    const scenario = normalizeUserRateScenario({
      termDeposit: { balance: '50000', currentRate: '4.8' },
      projections: {
        termDeposit: { termMonths: '12', rollovers: '1', reinvestInterest: true, lowerRate: '3', higherRate: '6' },
      },
    });
    const result = buildLifecycleProjection('TD', scenario, NOW);
    const firstMaturities = result.rateSeries.map((series) => series.points[12].balance);
    expect(firstMaturities[0]).toBeCloseTo(firstMaturities[1], 6);
    expect(firstMaturities[1]).toBeCloseTo(firstMaturities[2], 6);
    expect(result.rateSeries[0].totalValue).toBeLessThan(result.rateSeries[2].totalValue);
  });

  it('steps a conditional savings rate down only after its entered bonus period', () => {
    const met = normalizeUserRateScenario({
      savings: { balance: '5000', currentRate: '5' },
      projections: {
        savings: {
          horizonYears: '1',
          savingsRateStructure: 'conditional-bonus',
          ongoingRate: '2',
          bonusMonthsRemaining: '3',
          bonusConditionsMet: true,
        },
      },
    });
    const unmet = normalizeUserRateScenario({
      ...met,
      projections: { savings: { ...met.projections.savings, bonusConditionsMet: false } },
    });
    const metResult = buildLifecycleProjection('Savings', met, NOW);
    const unmetResult = buildLifecycleProjection('Savings', unmet, NOW);
    expect(metResult.rateSeries[1].points[1].periodInterest).toBeCloseTo(5000 * 0.05 / 12, 6);
    expect(unmetResult.rateSeries[1].points[1].periodInterest).toBeCloseTo(5000 * 0.02 / 12, 6);
    expect(metResult.rateSeries[1].endBalance).toBeGreaterThan(unmetResult.rateSeries[1].endBalance);
  });

  it('honours an explicit 0% lower scenario and omits an empty offset boost', () => {
    const scenario = normalizeUserRateScenario({
      mortgage: { mode: 'refi', loanBalance: '300000', currentRate: '5', years: '20' },
      projections: { mortgage: { lowerRate: '0', offsetBoostAmount: '' } },
    });
    const result = buildLifecycleProjection('Mortgage', scenario, NOW);
    expect(result.rateSeries[0].annualRate).toBe(0);
    expect(result.offsetSeries).toHaveLength(2);
  });

  it('blocks incomplete history and invalid directional scenarios instead of silently replacing them', () => {
    const scenario = normalizeUserRateScenario({
      savings: { balance: '1000', currentRate: '4' },
      projections: { savings: { horizonYears: '2', startDate: '2024-01-01', lowerRate: '5' } },
    });
    const result = buildLifecycleProjection('Savings', scenario, NOW);
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual(expect.arrayContaining([
      expect.stringMatching(/historical starting/i),
      expect.stringMatching(/lower-rate scenario/i),
    ]));
  });

  it('blocks negative or unbounded optional cash-flow inputs', () => {
    const scenario = normalizeUserRateScenario({
      savings: { balance: '1000', currentRate: '4' },
      projections: { savings: { horizonYears: '2', periodicAmount: '-1' } },
    });
    const result = buildLifecycleProjection('Savings', scenario, NOW);
    expect(result.ready).toBe(false);
    expect(result.missing).toContain('regular amount from $0 to $1 trillion');
  });

  it('preserves month-end dates and uses section-correct savings labels', () => {
    const scenario = normalizeUserRateScenario({
      savings: { balance: '1000', currentRate: '4' },
      projections: { savings: { horizonYears: '1' } },
    });
    const result = buildLifecycleProjection('Savings', scenario, new Date('2027-01-31T10:00:00Z'));
    expect(result.rateSeries[1].points[1].date).toBe('2027-02-28');
    expect(result.rateSeries[1].points[2].date).toBe('2027-03-31');
    expect(projectionMetricLabel('Savings', 'periodPrincipal')).toBe('Net deposits / month');
    expect(projectionMetricLabel('Mortgage', 'periodPrincipal')).toBe('Principal / month');
  });

  it('reports the exact missing basics instead of inventing a projection', () => {
    const result = buildLifecycleProjection('Mortgage', normalizeUserRateScenario({}), NOW);
    expect(result.ready).toBe(false);
    expect(result.missing).toEqual([
      'current loan balance up to $1 trillion',
      'current interest rate from 0% to 100%',
      `remaining term from 1 month to ${MAX_PROJECTION_YEARS} years`,
    ]);
  });

  it('uses LVR-derived loan balance in buy mode', () => {
    const scenario = normalizeUserRateScenario({
      mortgage: {
        mode: 'buy',
        propertyValue: '800000',
        deposit: '160000',
        costs: '10000',
        currentRate: '6',
        years: '25',
      },
      projections: { mortgage: {} },
    });
    const result = buildLifecycleProjection('Mortgage', scenario, NOW);
    expect(result.ready).toBe(true);
    expect(result.rateSeries[1].points[0].balance).toBe(650000);
  });

  it('accepts remaining terms up to the shared maximum and rejects above it', () => {
    const atMax = normalizeUserRateScenario({
      mortgage: { mode: 'refi', loanBalance: '300000', currentRate: '5', years: String(MAX_PROJECTION_YEARS) },
      projections: { mortgage: {} },
    });
    const aboveMax = normalizeUserRateScenario({
      mortgage: { mode: 'refi', loanBalance: '300000', currentRate: '5', years: String(MAX_PROJECTION_YEARS + 1) },
      projections: { mortgage: {} },
    });
    expect(buildLifecycleProjection('Mortgage', atMax, NOW).ready).toBe(true);
    const blocked = buildLifecycleProjection('Mortgage', aboveMax, NOW);
    expect(blocked.ready).toBe(false);
    expect(blocked.missing).toContain(`remaining term from 1 month to ${MAX_PROJECTION_YEARS} years`);
  });

  it('carries historical offset into forward scenarios and warns on mismatch', () => {
    const scenario = normalizeUserRateScenario({
      mortgage: { mode: 'refi', loanBalance: '460000', currentRate: '6.2', years: '22' },
      projections: {
        mortgage: {
          startDate: '2021-08-04',
          startBalance: '600000',
          startRate: '2.8',
          offsetBalance: '50000',
          startOffsetBalance: '10000',
          offsetContributionAmount: '500',
          offsetContributionFrequency: 'monthly',
          periodicAmount: '2800',
          periodicFrequency: 'monthly',
        },
      },
    });
    const result = buildLifecycleProjection('Mortgage', scenario, NOW);
    const historicalLastOffset = result.history.at(-1)!.offsetBalance;
    expect(historicalLastOffset).toBeGreaterThan(10000);
    expect(result.rateSeries[1].points[0].offsetBalance).toBe(historicalLastOffset);
    expect(result.warnings.join(' ')).toMatch(/simulated offset/i);
  });

  it('labels conditional savings ongoing rate distinctly during the bonus period', () => {
    const scenario = normalizeUserRateScenario({
      savings: { balance: '5000', currentRate: '5' },
      projections: {
        savings: {
          horizonYears: '1',
          savingsRateStructure: 'conditional-bonus',
          ongoingRate: '2',
          bonusMonthsRemaining: '3',
          bonusConditionsMet: true,
        },
      },
    });
    const result = buildLifecycleProjection('Savings', scenario, NOW);
    expect(result.rateSeries[1].label).toBe('Ongoing rate');
    expect(result.rateSeries[1].detail).toMatch(/5\.00% conditional for 3 months, then 2\.00% ongoing/);
    expect(result.rateSeries[0].detail).toMatch(/5\.00% conditional for 3 months, then 1\.00% ongoing/);
  });

  it('parses fraction-form rate strings consistently with toFraction', () => {
    const scenario = normalizeUserRateScenario({
      mortgage: { mode: 'refi', loanBalance: '100000', currentRate: '0.064', years: '10' },
      projections: { mortgage: {} },
    });
    const result = buildLifecycleProjection('Mortgage', scenario, NOW);
    expect(result.ready).toBe(true);
    expect(result.rateSeries[1].annualRate).toBeCloseTo(0.064, 6);
    expect(result.rateSeries[1].points[1].periodInterest).toBeCloseTo(100000 * 0.064 / 12, 6);
  });
});
