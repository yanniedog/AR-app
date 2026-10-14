import { Text } from 'react-native';
import { legalDocumentText, type LegalDocumentId } from '../lib/uiCopy';
import { useTheme } from '../theme/ThemeProvider';
import { fontStyle } from '../theme/fonts';

/** Actual legal/licence text only. No raw children, provider body or page exemption. */
export function DocumentText({ document, index }: { document: LegalDocumentId; index?: number }) {
  const theme = useTheme();
  return <Text selectable style={{ color: theme.colors.textMuted, fontSize: theme.font.small, ...fontStyle() }}>
    {legalDocumentText(document, index)}
  </Text>;
}
