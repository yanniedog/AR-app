import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RbaDecisionEntry } from './rbaCalendar';

const STORAGE_KEY = 'ar-rates:rba-decision-notification-receipts:v1';
const MAX_RECEIPTS = 64;
let claimQueue: Promise<void> = Promise.resolve();

export function rbaDecisionNotificationIdentity(decision: RbaDecisionEntry): string {
  return [decision.date, decision.effective ?? '', decision.rate, decision.delta_bps, decision.outcome].join('|');
}

function parseReceipts(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function claimRbaDecisionNotificationReceipts(ids: readonly string[]): Promise<string[]> {
  const requested = [...new Set(ids.filter(Boolean))];
  if (!requested.length) return Promise.resolve([]);
  let resolveClaim!: (ids: string[]) => void;
  let rejectClaim!: (error: unknown) => void;
  const result = new Promise<string[]>((resolve, reject) => {
    resolveClaim = resolve;
    rejectClaim = reject;
  });
  claimQueue = claimQueue.then(async () => {
    try {
      const existing = parseReceipts(await AsyncStorage.getItem(STORAGE_KEY));
      const seen = new Set(existing);
      const claimed = requested.filter((id) => !seen.has(id));
      if (claimed.length) {
        await AsyncStorage.setItem(
          STORAGE_KEY,
          JSON.stringify([...existing, ...claimed].slice(-MAX_RECEIPTS)),
        );
      }
      resolveClaim(claimed);
    } catch (error) {
      rejectClaim(error);
    }
  }).catch(() => undefined);
  return result;
}
