import { Text, useWindowDimensions } from 'react-native';
import type { ReplayDocument } from '../data/receiptReplay/types';
import { useTheme } from '../theme/ThemeProvider';

/** Explicit original receipt document after the existing parser's admission. */
export function ReceiptEvidenceText({ document }: { document: ReplayDocument }) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  return <Text key={fontScale} selectable style={{ color: theme.colors.text, fontSize: theme.font.tiny, fontFamily: 'monospace' }}>
    {JSON.stringify(document.original, null, 2)}
  </Text>;
}
