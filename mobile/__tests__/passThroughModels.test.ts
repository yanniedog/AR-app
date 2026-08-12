import type { MultiSectionPassThroughModel } from '../src/data/bankInsights';
import {
  buildBankResponseProfiles,
  buildResponseScatterPoints,
  clampScatterZoom,
  filterAndSortSectionRows,
  formatScatterDecisionLabel,
  lenderResponseAccessibilityLabel,
  nextScatterZoom,
  passThroughCustomerContext,
  passThroughEvidenceLabel,
  resolveResponseScatterPress,
  responseWindowSwipeDirection,
  selectResponseScatterProvider,
  summarizeSectionResponse,
} from '../src/data/passThroughModels';
import type { BankInsightsPayload } from '../src/data/bankInsights';
import type { RbaCalendar } from '../src/data/rbaCalendar';

const model: MultiSectionPassThroughModel = {
  decision: {
    date: '2026-05-05',
    bps: 25,
    outcome: 'hike',
    partialObservation: true,
  },
  rows: [
    {
      provider: 'Alpha',
      sections: {
        Mortgage: {
          provider: 'Alpha',
          passedBps: 20,
          netChangeBps: 20,
          daysToFirstMove: 8,
          ratio: null,
          baselineComplete: false,
          passStatus: 'unscored',
        },
      },
    },
    {
      provider: 'Beta',
      sections: {
        Mortgage: {
          provider: 'Beta',
          passedBps: 0,
          netChangeBps: -10,
          daysToFirstMove: null,
          ratio: null,
          baselineComplete: false,
          passStatus: 'unscored',
        },
      },
    },
    {
      provider: 'Gamma',
      sections: {
        Mortgage: {
          provider: 'Gamma',
          passedBps: 10,
          netChangeBps: 10,
          daysToFirstMove: 4,
          ratio: 0.4,
          baselineComplete: true,
          passStatus: 'partial',
        },
      },
    },
  ],
  windowDays: 45,
  windowEnd: '2026-06-19',
  observedThrough: '2026-07-16',
  windowOpen: false,
};

describe('pass-through presentation models', () => {
  test('summarises each section independently', () => {
    expect(summarizeSectionResponse(model, 'Mortgage')).toEqual({
      eligible: 3,
      movedWithRba: 2,
      movedOpposite: 1,
      unchanged: 0,
      medianObservedBps: 15,
      medianDays: 6,
      completeBaselines: 1,
      fullOrOver: 0,
    });
    expect(summarizeSectionResponse(model, 'Savings').eligible).toBe(0);
  });

  test('sorts by response, timing, or name without inventing a winner label', () => {
    expect(filterAndSortSectionRows(model, 'Mortgage', '', 'response').map((r) => r.provider)).toEqual([
      'Alpha',
      'Gamma',
      'Beta',
    ]);
    expect(filterAndSortSectionRows(model, 'Mortgage', '', 'timing').map((r) => r.provider)).toEqual([
      'Gamma',
      'Alpha',
      'Beta',
    ]);
    expect(filterAndSortSectionRows(model, 'Mortgage', 'et', 'bank').map((r) => r.provider)).toEqual([
      'Beta',
    ]);
    expect(filterAndSortSectionRows(model, 'Mortgage', 'zzz', 'bank')).toEqual([]);
  });

  test('explains customer impact with section-aware direction', () => {
    expect(passThroughCustomerContext('Mortgage', 25)).toContain('worse for borrowers');
    expect(passThroughCustomerContext('Mortgage', -25)).toContain('better for borrowers');
    expect(passThroughCustomerContext('Savings', 25)).toContain('better for savers');
    expect(passThroughCustomerContext('TD', -25)).toContain('worse for savers');
  });

  test('labels incomplete evidence explicitly', () => {
    expect(passThroughEvidenceLabel(model)).toBe('Early evidence · partial history');
  });

  test('selects the nearest scatter point and cycles dense overlapping lenders', () => {
    const points = [
      { provider: 'Great Southern Bank', cx: 100, cy: 80 },
      { provider: 'Great Southern Bank Business+', cx: 103, cy: 81 },
      { provider: 'Far Away Bank', cx: 200, cy: 200 },
    ];

    expect(selectResponseScatterProvider(points, 100, 80, null)).toBe('Great Southern Bank');
    expect(selectResponseScatterProvider(points, 100, 80, 'Great Southern Bank')).toBe(
      'Great Southern Bank Business+',
    );
    expect(selectResponseScatterProvider(points, 0, 0, null)).toBeNull();
  });

  test('resolves chart presses with miss vs toggle-off and builds stable plot geometry', () => {
    const points = [
      { provider: 'Great Southern Bank', cx: 100, cy: 80 },
      { provider: 'Great Southern Bank Business+', cx: 103, cy: 81 },
    ];

    expect(resolveResponseScatterPress(points, 0, 0, null)).toEqual({ hit: false });
    expect(resolveResponseScatterPress(points, 100, 80, null)).toEqual({
      hit: true,
      provider: 'Great Southern Bank',
    });
    expect(resolveResponseScatterPress(points, 100, 80, 'Great Southern Bank')).toEqual({
      hit: true,
      provider: 'Great Southern Bank Business+',
    });
    expect(
      resolveResponseScatterPress(
        [{ provider: 'Solo Bank', cx: 50, cy: 50 }],
        50,
        50,
        'Solo Bank',
      ),
    ).toEqual({ hit: true, provider: null });

    const plot = buildResponseScatterPoints(
      [
        {
          provider: 'Alpha',
          sections: model.rows[0].sections,
          response: model.rows[0].sections.Mortgage!,
        },
        {
          provider: 'Beta',
          sections: model.rows[1].sections,
          response: model.rows[1].sections.Mortgage!,
        },
      ],
      {
        width: 320,
        height: 260,
        padL: 42,
        padR: 10,
        padT: 24,
        padB: 46,
        windowDays: 45,
        decisionBps: 25,
        decisions: [
          { date: '2026-05-05', bps: 25, active: true },
          { date: '2025-11-05', bps: -25, active: false },
          { date: '2025-02-19', bps: 25, active: false },
        ],
      },
    );
    expect(plot.points).toHaveLength(2);
    expect(plot.points[0].hasTiming).toBe(true);
    expect(plot.points[1].hasTiming).toBe(false);
    expect(plot.points[0].cx).toBeLessThan(plot.untimedX);
    expect(plot.points[1].cx).toBeGreaterThan(plot.timedW);
    expect(plot.decisionLines).toHaveLength(3);
    expect(plot.decisionLines.filter((line) => line.active)).toHaveLength(1);
    expect(plot.decisionLines.some((line) => line.bps === -25)).toBe(true);
    expect(plot.maxBps).toBeGreaterThanOrEqual(25);
    // Shared +25bp decisions keep the same guide Y; only labels stagger.
    const plus25 = plot.decisionLines.filter((line) => line.bps === 25);
    expect(plus25[0].y).toBe(plus25[1].y);
    expect(plus25[1].labelDy).toBeGreaterThan(plus25[0].labelDy);
  });

  test('clamps scatter zoom and filters the lender list to a selected bank', () => {
    expect(clampScatterZoom(0.2)).toBe(1);
    expect(clampScatterZoom(9)).toBe(3);
    expect(nextScatterZoom(1, 1)).toBe(1.5);
    expect(nextScatterZoom(1.5, -1)).toBe(1);
    expect(formatScatterDecisionLabel('2026-05-05', 25)).toMatch(/5 May/);
    expect(formatScatterDecisionLabel('2026-05-05', 25)).toContain('+25');
    expect(formatScatterDecisionLabel('2025-11-05', -25)).toContain('−25');
    expect(formatScatterDecisionLabel('bad', 10)).toBe('bad +10');
    expect(formatScatterDecisionLabel('', -5)).toBe('— −5');

    expect(
      filterAndSortSectionRows(model, 'Mortgage', '', 'bank', 'Gamma').map((row) => row.provider),
    ).toEqual(['Gamma']);
    expect(filterAndSortSectionRows(model, 'Mortgage', 'zzz', 'bank', 'Gamma')).toEqual([]);
  });

  test('maps carousel flicks to older and newer response windows', () => {
    expect(responseWindowSwipeDirection(-60)).toBe('older');
    expect(responseWindowSwipeDirection(60)).toBe('newer');
    expect(responseWindowSwipeDirection(20)).toBeNull();
  });

  test('announces all aligned lender columns without truncating the provider', () => {
    const row = {
      provider: 'Great Southern Bank Business+',
      sections: {
        Mortgage: model.rows[0].sections.Mortgage,
        Savings: {
          ...model.rows[0].sections.Mortgage!,
          provider: 'Great Southern Bank Business+',
          passedBps: 5,
          netChangeBps: 5,
        },
      },
    };

    const label = lenderResponseAccessibilityLabel(row, 'Savings', false);
    expect(label).toContain('Great Southern Bank Business+');
    expect(label).toContain('Savings accounts: +5 bp');
    expect(label).not.toContain('Home loans');
  });

  test('keeps current waiting evidence separate from complete historical tendencies', () => {
    const payload: BankInsightsPayload = {
      schema_version: 1,
      run_date: '2026-08-20',
      run_dates: ['2026-01-01', '2026-02-05', '2026-04-30', '2026-05-20', '2026-08-20'],
      banks: {
        FollowBank: {
          Mortgage: {
            median: [0.06, 0.0575, 0.0575, 0.06, 0.06],
            best: [0.055, 0.0525, 0.0525, 0.055, 0.055],
            count: [3, 3, 3, 3, 3],
          },
        },
        WaitingBank: {
          Mortgage: {
            median: [0.061, 0.061, 0.061, 0.061, 0.061],
            best: [0.056, 0.056, 0.056, 0.056, 0.056],
            count: [3, 3, 3, 3, 3],
          },
        },
      },
      events: [
        { date: '2026-02-05', provider: 'FollowBank', section: 'Mortgage', dir: 'cut', moved: 3, total: 3, avg_bps: -25 },
        { date: '2026-05-20', provider: 'FollowBank', section: 'Mortgage', dir: 'hike', moved: 3, total: 3, avg_bps: 25 },
      ],
    };
    const calendar: RbaCalendar = {
      timezone: 'Australia/Sydney',
      decisions: [
        { date: '2026-02-01', effective: '2026-02-02', rate: 4.1, delta_bps: -25, outcome: 'cut' },
        { date: '2026-05-05', effective: '2026-05-06', rate: 4.35, delta_bps: 25, outcome: 'hike' },
        { date: '2026-06-16', effective: null, rate: 4.35, delta_bps: 0, outcome: 'hold' },
      ],
      schedule: [],
    };
    const rba = [
      { date: '2026-01-01', rate: 4.35 },
      { date: '2026-02-02', rate: 4.1 },
      { date: '2026-05-06', rate: 4.35 },
    ];

    const cuts = buildBankResponseProfiles(payload, rba, calendar, 'Mortgage', 'cut');
    expect(cuts.find((profile) => profile.provider === 'FollowBank')).toMatchObject({
      windowsObserved: 1,
      movedWithRba: 1,
      responseRatePct: 100,
      currentWindowIncluded: false,
    });

    const hikes = buildBankResponseProfiles(payload, rba, calendar, 'Mortgage', 'hike');
    expect(hikes.find((profile) => profile.provider === 'WaitingBank')).toMatchObject({
      windowsObserved: 0,
      responseRatePct: null,
      currentWindowIncluded: true,
      currentStatus: 'waiting',
    });
    expect(hikes.find((profile) => profile.provider === 'FollowBank')).toMatchObject({
      windowsObserved: 0,
      responseRatePct: null,
      currentWindowIncluded: true,
      currentStatus: 'followed',
    });
  });
});
