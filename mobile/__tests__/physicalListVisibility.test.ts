import { physicallyVisible } from '../src/hooks/usePhysicalListVisibility';

const window = { width: 412, height: 915 };
const viewport = { x: 0, y: 320, width: 412, height: 529 };
describe('physical product visibility', () => {
  it('rejects a row below the usable viewport despite virtualized membership', () => {
    expect(physicallyVisible({ x: 16, y: 949, width: 380, height: 220 }, viewport, window)).toBe(false);
  });
  it('rejects collapsed and undersized cells', () => {
    expect(physicallyVisible({ x: 16, y: 400, width: 1, height: 1 }, viewport, window)).toBe(false);
  });
  it('excludes the bottom navigation and requires a usable visible target', () => {
    expect(physicallyVisible({ x: 16, y: 830, width: 380, height: 220 }, viewport, window)).toBe(false);
    expect(physicallyVisible({ x: 16, y: 790, width: 380, height: 220 }, viewport, window)).toBe(true);
  });
  it('handles large text rows, horizontal clipping, safe-area bounds and invalid measurements', () => {
    expect(physicallyVisible({ x: 16, y: 250, width: 380, height: 600 }, viewport, window)).toBe(true);
    expect(physicallyVisible({ x: 400, y: 400, width: 380, height: 600 }, viewport, window)).toBe(false);
    expect(physicallyVisible({ x: 16, y: -100, width: 380, height: 120 }, { ...viewport, y: 44, height: 805 }, window)).toBe(false);
    expect(physicallyVisible({ x: 0, y: NaN, width: 380, height: 200 }, viewport, window)).toBe(false);
  });
});
