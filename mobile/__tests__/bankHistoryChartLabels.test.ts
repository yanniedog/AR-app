import { chartLabelWidth, edgeLabelAnchor } from '../src/components/BankHistoryChart';

describe('history chart edge labels', () => {
  const left = 44, right = 352;

  it('anchors the last date inwards at the plot edge', () => {
    expect(edgeLabelAnchor(right, '7 Nov', 10, left, right)).toEqual({ x: right, anchor: 'end' });
  });

  it('anchors the first date inwards instead of overlapping the y-axis', () => {
    expect(edgeLabelAnchor(left, '13 May', 10, left, right)).toEqual({ x: left, anchor: 'start' });
  });

  it('keeps interior dates centred', () => {
    expect(edgeLabelAnchor(200, '24 Jul', 10, left, right)).toEqual({ x: 200, anchor: 'middle' });
  });

  it('estimates wider text for longer labels', () => {
    expect(chartLabelWidth('+25.0 bps', 9)).toBeGreaterThan(chartLabelWidth('+25', 9));
  });
});
