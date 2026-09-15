import { addCalendarMonths, dayNumber, calendarDate, isLeapYear } from '../calendar';
import { Decimal } from '../decimal';
import { runtimeConformance } from '../runtimeConformance';

describe('exact arithmetic primitives', () => {
  test('runtime self-check reports its actual runtime rather than calling Node Hermes', () => {
    expect(runtimeConformance()).toMatchObject({ runtime: 'other', passed: true });
  });
  test('integer support remains exact beyond JavaScript safe integers', () => {
    expect(Decimal.parse('9007199254740993.01').add(Decimal.parse('0.02')).fixed()).toBe('9007199254740993.03');
    expect(Decimal.parse('0.1').add(Decimal.parse('0.2')).compare(Decimal.parse('0.3'))).toBe(0);
    expect(Decimal.parse('1').div(Decimal.parse('3')).mul(Decimal.parse('3')).fixed()).toBe('1.00');
  });
  test.each([
    ['1.005', 'half_up', '1.01'], ['1.005', 'half_even', '1.00'], ['1.015', 'half_even', '1.02'],
    ['-1.005', 'half_up', '-1.01'], ['-1.005', 'half_even', '-1.00'], ['-1.009', 'toward_zero', '-1.00'],
  ] as const)('rounding %s using %s', (value, mode, expected) => {
    expect(Decimal.parse(value).fixed(2, mode)).toBe(expected);
  });
  test.each(['NaN', 'Infinity', '1e-2', '', '01', '-.2', '0.0000000000000000000000001'])('rejects ambiguous decimal %s', value => {
    expect(() => Decimal.parse(value)).toThrow();
  });
  test('zero and signs retain exact semantics', () => {
    expect(Decimal.parse('-0.01').fixed()).toBe('-0.01');
    expect(Decimal.parse('0').fixed()).toBe('0.00');
    expect(() => Decimal.parse('1').div(Decimal.parse('0'))).toThrow('division_by_zero');
  });
});

describe('explicit UTC calendar primitives', () => {
  test('February29, month ends and centuries', () => {
    expect(calendarDate(dayNumber('2024-02-28') + 1)).toBe('2024-02-29');
    expect(calendarDate(dayNumber('2024-02-29') + 1)).toBe('2024-03-01');
    expect(addCalendarMonths('2024-01-31', 1, 'clamp')).toBe('2024-02-29');
    expect(addCalendarMonths('2024-02-29', 1, 'preserve_month_end')).toBe('2024-03-31');
    expect(addCalendarMonths('2024-02-29', 1, 'clamp')).toBe('2024-03-29');
    expect(addCalendarMonths('2024-02-29', 12, 'clamp')).toBe('2025-02-28');
    expect(isLeapYear(2000)).toBe(true); expect(isLeapYear(2100)).toBe(false);
  });
  test.each(['2026-02-29', '2026-04-31', '2026-1-01', '2026-01-01T00:00:00Z'])('rejects invalid dates %s', value => {
    expect(() => dayNumber(value)).toThrow();
  });
});
