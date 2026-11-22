import { lvrTierLabel } from '../src/data/lvrTier';
import { lvrRangeContains, matchesLvrTier, parseLvrRange } from '../src/data/lvrRange';

describe('LVR published as a ratio', () => {
  it('reads 0.7 as 70% when parsing a band', () => {
    expect(parseLvrRange('lvr_=0.7')).toMatchObject({ lo: 0, hi: 70 });
    expect(parseLvrRange('lvr_=0.85')).toMatchObject({ hi: 85 });
    expect(parseLvrRange('lvr_=1')).toMatchObject({ hi: 100 });
    expect(lvrRangeContains(parseLvrRange('lvr_=0.7')!, 65)).toBe(true);
    expect(lvrRangeContains(parseLvrRange('lvr_=0.7')!, 75)).toBe(false);
  });
  it('reads a ratio range on both ends', () => {
    expect(parseLvrRange('lvr_0.6-0.8')).toMatchObject({ lo: 60, hi: 80 });
  });
  it('leaves percentage bands alone', () => {
    expect(parseLvrRange('lvr_=60%')).toMatchObject({ hi: 60 });
    expect(parseLvrRange('lvr_0.0001-80')).toMatchObject({ lo: 0.0001, hi: 80 });
    expect(parseLvrRange('lvr_=10')).toMatchObject({ hi: 10 });
  });
  it('labels a ratio tier as a percentage', () => {
    expect(String(lvrTierLabel('lvr_=0.7'))).toBe('LVR ≤70.0%');
    expect(String(lvrTierLabel('lvr_=0.85'))).toBe('LVR ≤85.0%');
  });
  it('matches a selected 80% filter against a ratio tier of 0.8', () => {
    expect(matchesLvrTier('lvr_=0.8', ['lvr_=80%'])).toBe(true);
  });

  it('reads open-ended ratio bounds as percentages so filtering matches the label', () => {
    expect(parseLvrRange('lvr_>=0.7')).toMatchObject({ lo: 70, inclusive: true });
    expect(parseLvrRange('lvr_0.7+')).toMatchObject({ lo: 70 });
    expect(parseLvrRange('lvr_>0.8')).toMatchObject({ lo: 80, inclusive: false });
    expect(lvrRangeContains(parseLvrRange('lvr_>=0.7')!, 65)).toBe(false);
    expect(String(lvrTierLabel('lvr_>=0.7'))).toBe('LVR ≥70.0%');
  });
  it('leaves explicitly percentage-marked values alone', () => {
    expect(parseLvrRange('lvr_=0.7%')).toMatchObject({ hi: 0.7 });
    expect(String(lvrTierLabel('lvr_=0.7%'))).toBe('LVR ≤0.700%');
  });
  it('labels underscore ratio ranges', () => {
    expect(String(lvrTierLabel('lvr_0.6_0.8'))).toBe('LVR 60.0–80.0%');
  });
});
