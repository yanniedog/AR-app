import { uiDate } from '../src/lib/uiCopy';

test('publication calendar days survive a western device timezone while timestamps stay local', () => {
  const original = Date.prototype.toLocaleDateString;
  const local = jest.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (this: Date, locale, options) {
    return original.call(this, locale, { timeZone: 'America/Los_Angeles', ...options });
  });
  try {
    expect(uiDate('2026-10-14')).toBe('14 Oct 2026');
    expect(uiDate('2026-10-14T00:00:00Z')).toBe('13 Oct 2026');
    expect(uiDate('2026-02-30')).toBe('Unknown');
    expect(uiDate('A source explanation')).toBe('Unknown');
  } finally { local.mockRestore(); }
});
