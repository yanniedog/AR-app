import { useSyncExternalStore } from 'react';
import { Text } from 'react-native';
import { debugLog } from '../lib/debugLog';
import { useTheme } from '../theme/ThemeProvider';

/** Actual bounded local log, explicitly opened as an evidence document. */
export function DebugEvidenceText() {
  const theme = useTheme();
  const text = useSyncExternalStore(debugLog.subscribe, debugLog.getDisplayText, debugLog.getDisplayText);
  return <Text selectable style={{ color: theme.colors.text, fontSize: theme.font.tiny, fontFamily: 'monospace' }}>{text}</Text>;
}
