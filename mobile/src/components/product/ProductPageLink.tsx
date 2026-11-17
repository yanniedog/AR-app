import React, { createContext, useContext, useMemo } from 'react';
import { Pressable } from 'react-native';
import { useAuditExternalLinks } from '../../hooks/useAuditExternalLinks';
import { StandardUrl } from '../../lib/standardUrl';
import { trustedExternalUrl } from '../../lib/trustedExternalUrl';
import type { UiChild, UiCopy } from '../../lib/uiCopy';
import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';
import AppIcon from '../icons/AppIcon';
import { TOUCH_TARGET_MIN } from '../TouchTarget';
import { Row } from '../ui';

const ProductPageContext = createContext<string | null>(null);

export function ProductPageLinks({ overview, children }: { overview?: string; children: UiChild }) {
  const link = useMemo(() => {
    if (!overview) return null;
    const result = trustedExternalUrl({ url: overview, purpose: 'lender_source', label: 'Product' });
    if (!result.ok) return null;
    const { hostname, pathname } = new StandardUrl(result.url);
    let path: string;
    try {
      path = decodeURIComponent(pathname);
    } catch {
      return null;
    }
    // A published overview can still be a bank landing page, document or API.
    if (/^\/(?:index\.(?:html?|php)\/?|home\/?|(?:en|en-au)\/?)?$/i.test(path)
      || /\.(?:pdf|json|xml|ya?ml)\/?$/i.test(path)
      || /^(?:apis?|cdr|cds|open-?banking)[.-]/i.test(hostname)
      || /(?:^|\/)(?:apis?|cds-au|open-?banking)(?:\/|$)/i.test(path)) return null;
    return result.url;
  }, [overview]);
  useAuditExternalLinks(link ? [{ url: link, purpose: 'lender_source', label: 'Product' }] : []);
  return <ProductPageContext.Provider value={link}>{children}</ProductPageContext.Provider>;
}

function LinkedFact({ url, label, children }: { url: string; label: UiCopy; children: UiChild }) {
  const { requestExternalUrl } = useTrustedExternalUrl();
  return <Pressable accessibilityRole="link" accessibilityLabel={label}
    style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1, minHeight: TOUCH_TARGET_MIN, minWidth: TOUCH_TARGET_MIN, justifyContent: 'center' })}
    onPress={() => requestExternalUrl({ url, purpose: 'lender_source', label: 'Product' })}>
    <Row gap={8} style={{ alignItems: 'center' }}>
      <Row style={{ flex: 1 }}>{children}</Row>
      <AppIcon name="open-outline" size={14} />
    </Row>
  </Pressable>;
}

export function ProductPageLink({ label, children }: { label: UiCopy; children: UiChild }) {
  const url = useContext(ProductPageContext);
  return url ? <LinkedFact url={url} label={label}>{children}</LinkedFact> : <>{children}</>;
}
