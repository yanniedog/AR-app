import { CHART_CONTROL_TARGET_PX } from '../src/components/charts/ChartSliceControls';
import {
  extendSteppedSeriesThroughDate,
  holdDatesWithinSeriesWindow,
} from '../src/components/economy/EconomicChartFrame';
import {
  plotLocalX,
  rbaSeriesThroughDate,
  rbaTimelineDates,
  sliceIndexFromPlotX,
} from '../src/data/bankHistoryTransform';

describe('chart accessibility contracts', () => {
  it('uses a true 48dp previous/next target', () => {
    expect(CHART_CONTROL_TARGET_PX).toBe(48);
  });

  it('maps a container touch after subtracting the plot padding', () => {
    const local = plotLocalX(84, 34, 200);
    expect(local).toBe(50);
    expect(sliceIndexFromPlotX(local, 200, 5)).toBe(1);
  });

  it('keeps post-change hold meetings selectable at the held rate', () => {
    expect(rbaTimelineDates([{ date: '2026-05-01', rate: 4.35 }], ['2026-08-11'])).toEqual([
      '2026-05-01',
      '2026-08-11',
    ]);
    expect(rbaSeriesThroughDate(
      [{ date: '2026-05-01', rate: 4.35 }],
      '2026-08-11',
    )).toEqual([
      { date: '2026-05-01', rate: 4.35 },
      { date: '2026-08-11', rate: 4.35 },
    ]);
  });

  it('keeps policy holds inside the chart domain, including holds after the last change', () => {
    expect(holdDatesWithinSeriesWindow(
      [{ date: '2025-08-01', value: 4.1 }, { date: '2026-05-06', value: 3.85 }],
      ['2024-06-01', '2025-10-15', '2026-06-16', '2027-02-01'],
      '2026-12-01',
    )).toEqual(['2025-10-15', '2026-06-16']);
  });

  it('extends the actual policy step through the latest qualifying hold', () => {
    expect(extendSteppedSeriesThroughDate(
      [{ date: '2026-05-06', value: 3.85 }],
      '2026-06-16',
    )).toEqual([
      { date: '2026-05-06', value: 3.85 },
      { date: '2026-06-16', value: 3.85 },
    ]);
  });
});
