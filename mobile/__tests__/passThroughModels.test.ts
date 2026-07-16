import type { MultiSectionPassThroughModel } from '../src/data/bankInsights';
import {
  filterAndSortSectionRows,
  passThroughCustomerContext,
  passThroughEvidenceLabel,
  summarizeSectionResponse,
} from '../src/data/passThroughModels';

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
});
