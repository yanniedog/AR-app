import { Decimal } from './decimal';
import { addCalendarMonths } from './calendar';
import { EVALUATOR_VERSION } from './types';

/** Call from the native acceptance harness; Node success is explicitly not Hermes proof. */
export function runtimeConformance(): {
  evaluatorVersion: string; runtime: 'hermes' | 'other'; passed: boolean; checks: Record<string, boolean>;
} {
  const runtime = (globalThis as typeof globalThis & { HermesInternal?: unknown }).HermesInternal ? 'hermes' : 'other';
  const checks: Record<string, boolean> = {};
  try {
    checks.bigintBeyondSafeInteger = Decimal.parse('9007199254740993.01').add(Decimal.parse('0.02')).fixed() === '9007199254740993.03';
    checks.exactRational = Decimal.parse('1').div(Decimal.parse('3')).mul(Decimal.parse('3')).fixed() === '1.00';
    checks.negativeTieRounding = Decimal.parse('-1.005').fixed(2, 'half_even') === '-1.00';
    checks.leapMonthEnd = addCalendarMonths('2024-01-31', 1, 'clamp') === '2024-02-29';
  } catch { checks.execution = false; }
  return { evaluatorVersion: EVALUATOR_VERSION, runtime, passed: Object.values(checks).every(Boolean), checks };
}
