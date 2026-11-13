import { uiCount, uiDate, uiMoney } from '../src/lib/uiCopy';

test('repeated row facts reuse formatter instances without rounding or unknown-state changes', () => {
  const number = jest.spyOn(Intl, 'NumberFormat');
  const date = jest.spyOn(Intl, 'DateTimeFormat');
  try {
    expect(uiMoney(null)).toBe('Unknown');
    expect(uiCount(NaN)).toBe('Unknown');
    expect(uiDate('2026-02-30')).toBe('Unknown');
    expect(number).not.toHaveBeenCalled();
    expect(date).not.toHaveBeenCalled();
    for (let render = 0; render < 40; render++) {
      expect(uiCount(1234.567)).toBe('1,234.567');
      expect(uiMoney(1234.567, 2)).toBe('$1,234.57');
      expect(uiMoney(0, 2)).toBe('$0.00');
      expect(uiMoney(-25, 0)).toBe('-$25');
      expect(uiDate('2026-10-14')).toBe('14 Oct 2026');
      expect(uiDate('2026-10-15')).toBe('15 Oct 2026');
    }
    expect(number).toHaveBeenCalledTimes(3); // count, cents and whole dollars
    expect(date).toHaveBeenCalledTimes(1); // all publication calendar dates
  } finally { number.mockRestore(); date.mockRestore(); }
});
