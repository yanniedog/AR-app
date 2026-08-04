import { CHART_CONTROL_TARGET_PX } from '../src/components/charts/ChartSliceControls';
import { plotLocalX, rbaTimelineDates, sliceIndexFromPlotX } from '../src/data/bankHistoryTransform';

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
  });
});
