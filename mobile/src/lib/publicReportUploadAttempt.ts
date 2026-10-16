import AsyncStorage from '@react-native-async-storage/async-storage';

/** Only local content hashes and uncertainty flags: no report, URL or deletion key. */
const KEY = '@ar/public-report-upload-attempts-v1';
type Attempts = Record<string, 'pending' | 'failed'>;
async function load(): Promise<Attempts> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return {};
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.entries(value).some(([hash, phase]) => !/^[a-f0-9]{64}$/.test(hash) || !['pending', 'failed'].includes(phase))) {
    throw new Error('The saved upload attempt cannot be confirmed.');
  }
  return value as Attempts;
}
export async function publicReportUploadUncertain(hash: string): Promise<boolean> {
  return (await load())[hash] === 'pending';
}
export async function publicReportUploadAttempt(hash: string): Promise<'pending' | 'failed' | null> {
  return (await load())[hash] ?? null;
}
export async function recordPublicReportUploadAttempt(hash: string, phase: 'pending' | 'failed' | null): Promise<void> {
  const attempts = await load();
  if (phase == null) delete attempts[hash];
  else attempts[hash] = phase;
  // Pending entries must survive newer reports: they may identify an orphaned public copy.
  await AsyncStorage.setItem(KEY, JSON.stringify(attempts));
}
