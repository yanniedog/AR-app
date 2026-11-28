import React, { createContext, useContext, useMemo } from 'react';
import { Pressable } from 'react-native';
import { useAuditExternalLinks } from '../../hooks/useAuditExternalLinks';
import { StandardUrl } from '../../lib/standardUrl';
import { trustedExternalUrl } from '../../lib/trustedExternalUrl';
import type { UiChild, UiCopy } from '../../lib/uiCopy';
import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';
import AppIcon from '../icons/AppIcon';
import { TOUCH_TARGET_MIN } from '../TouchTarget';
import { AppText, Button, Row } from '../ui';
import type { NormalizedProductFact, ProductDetail } from '../../types';
import { factDocumentActions, type ProductDocumentAction } from '../../data/productDocuments';
import { uiJoin, type UiLabel } from '../../lib/uiCopy';

const ProductPageContext = createContext<ProductDetail | null>(null);
const ProductWebContext = createContext<string | null>(null);

const WEB_KINDS = ['overview', 'fees', 'eligibility', 'terms', 'bundle'] as const;
const NON_PAGE_URL = /\.(?:pdf|json|xml|ya?ml)\/?$/i;

/** The lender's own web page for the product: the product overview when it is a
 * real page, otherwise any other approved lender link, otherwise the overview
 * even when it is a landing page. Documents, feeds and API hosts never qualify. */
export function productWebUrl(links: ProductDetail['links'] | undefined, preferred: string | null): string | null {
  if (preferred) return preferred;
  const candidates = WEB_KINDS.flatMap(kind => links?.[kind] ? [links[kind] as string] : []);
  for (const url of candidates) {
    const result = trustedExternalUrl({ url, purpose: 'lender_source', label: 'Product' });
    if (!result.ok) continue;
    let hostname: string, pathname: string;
    try { ({ hostname, pathname } = new StandardUrl(result.url)); pathname = decodeURIComponent(pathname); } catch { continue; }
    if (NON_PAGE_URL.test(pathname) || /^(?:apis?|cdr|cds|open-?banking)[.-]/i.test(hostname)
      || /(?:^|\/)(?:apis?|cds-au|open-?banking)(?:\/|$)/i.test(pathname)) continue;
    return result.url;
  }
  return null;
}

export function ProductPageLinks({ overview, productDetails, children }: { overview?: string; productDetails?: ProductDetail | null; children: UiChild }) {
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
  const webLink = useMemo(() => productWebUrl(productDetails?.links ?? (overview ? { overview } : undefined), link), [productDetails?.links, overview, link]);
  useAuditExternalLinks(webLink ? [{ url: webLink, purpose: 'lender_source', label: 'Product' }] : []);
  return <ProductPageContext.Provider value={productDetails ?? null}><ProductWebContext.Provider value={webLink}>{children}</ProductWebContext.Provider></ProductPageContext.Provider>;
}

/** Opens the lender's product page. Hidden only when the lender publishes no usable page. */
export function ProductWebLink() {
  const url = useContext(ProductWebContext);
  const { requestExternalUrl } = useTrustedExternalUrl();
  if (!url) return null;
  return <Row style={{ marginBottom: 12 }}><Button title="Provider website" variant="secondary" icon="open-outline"
    onPress={() => requestExternalUrl({ url, purpose: 'lender_source', label: 'Product' })} /></Row>;
}

function LinkedFact({ url, action, label, children }: { url: string; action: ProductDocumentAction; label: UiCopy; children: UiChild }) {
  const { requestExternalUrl } = useTrustedExternalUrl();
  const relevance: UiLabel = action.relevance === 'verified' ? 'Verified' : action.relevance === 'conditional' ? 'Conditional'
    : action.relevance === 'supplementary' ? 'Supplementary' : 'Unverified';
  return <Pressable accessibilityRole="link" accessibilityLabel={uiJoin(label, ' · ', 'Source', ' · ', relevance)}
    style={({ pressed }) => ({ opacity: pressed ? 0.65 : 1, minHeight: TOUCH_TARGET_MIN, minWidth: TOUCH_TARGET_MIN, justifyContent: 'center' })}
    onPress={() => requestExternalUrl({ url, purpose: 'lender_source', label: 'Source', page: action.page })}>
    <Row gap={8} style={{ alignItems: 'center' }}>
      <Row style={{ flex: 1 }}>{children}</Row>
      <AppText variant="tiny">{uiJoin('Source', ' · ', relevance)}</AppText>
      <AppIcon name="open-outline" size={14} />
    </Row>
  </Pressable>;
}

export function ProductPageLink({ label, fact, children }: { label: UiCopy; fact?: NormalizedProductFact; children: UiChild }) {
  const detail = useContext(ProductPageContext);
  const action = fact && factDocumentActions(detail, fact).find(value => value.url);
  return action?.url ? <LinkedFact url={action.url} action={action} label={label}>{children}</LinkedFact> : <>{children}</>;
}
