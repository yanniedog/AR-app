import { Text, useWindowDimensions } from 'react-native';
import { productEvidencePageText, type ProductEvidencePage } from '../data/productEvidenceDocument';
import { useTheme } from '../theme/ThemeProvider';

/** Explicit original source evidence; the private admitted page caps rendered text. */
export function ProductEvidenceText({ page }: { page: ProductEvidencePage }) {
  const theme = useTheme(), { fontScale } = useWindowDimensions();
  return <Text key={fontScale} selectable style={{ color: theme.colors.text, fontSize: theme.font.tiny, fontFamily: 'monospace' }}>
    {productEvidencePageText(page)}
  </Text>;
}
