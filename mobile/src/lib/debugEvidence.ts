import * as Application from 'expo-application';
import { Share } from 'react-native';
import { debugLog, formatVersionedLogExport } from './debugLog';
import { uiLabel } from './uiCopy';

/** Explicit evidence export owns its source; it accepts no supplied text. */
export async function readVersionedDebugEvidence(fullEvidence = false): Promise<string> {
  const completeLog = await debugLog.readCompleteText();
  return formatVersionedLogExport(
    completeLog,
    Application.nativeApplicationVersion ?? 'unknown',
    Application.nativeBuildVersion ?? 'unknown',
    {},
    { fullEvidence },
  );
}

export async function shareVersionedDebugEvidence(fullEvidence = false): Promise<void> {
  await Share.share({
    message: await readVersionedDebugEvidence(fullEvidence),
    title: uiLabel('Debug log'),
  });
}
