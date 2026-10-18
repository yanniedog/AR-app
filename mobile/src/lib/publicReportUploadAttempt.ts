import AsyncStorage from '@react-native-async-storage/async-storage';

/** Only local content hashes and uncertainty flags: no report, URL or deletion key. */
const KEY = '@ar/public-report-upload-attempts-v1';
type Attempts = Record<string, 'pending' | 'failed'>;
let writes: Promise<void> = Promise.resolve();
let epoch = 0;
let clearing = 0;
export const publicReportUploadAttemptEpoch = () => epoch;
export const publicReportUploadAttemptIsCurrent = (value: number) => value === epoch && clearing === 0;
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
export async function recordPublicReportUploadAttempt(hash: string, phase: 'pending' | 'failed' | null, startedEpoch = epoch): Promise<void> {
  if (!publicReportUploadAttemptIsCurrent(startedEpoch)) return;
  const write = writes.catch(() => {}).then(async () => {
    if (!publicReportUploadAttemptIsCurrent(startedEpoch)) return;
    const attempts = await load();
    if (!publicReportUploadAttemptIsCurrent(startedEpoch)) return;
    if (phase == null) delete attempts[hash];
    else attempts[hash] = phase;
    await AsyncStorage.setItem(KEY, JSON.stringify(attempts));
  });
  writes = write;
  await write;
}
/** Begin synchronously at Debug log Clear entry; finish after its full storage critical section. */
export function beginPublicReportUploadAttemptsClear(): () => Promise<void> {
  epoch += 1; clearing += 1;
  let finished: Promise<void> | null = null;
  return () => {
    if (finished) return finished;
    const clear = writes.catch(() => {}).then(async () => {
      await AsyncStorage.removeItem(KEY);
      if (await AsyncStorage.getItem(KEY) != null) throw new Error('The upload attempt journal could not be cleared.');
    });
    writes = clear;
    finished = clear.finally(() => { clearing -= 1; });
    return finished;
  };
}
export async function clearPublicReportUploadAttempts(): Promise<void> {
  await beginPublicReportUploadAttemptsClear()();
}
