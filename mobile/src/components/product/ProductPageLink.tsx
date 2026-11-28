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
type ProductWebTarget = { url: string; kind: 'provider' | 'source' };
const ProductWebContext = createContext<ProductWebTarget | null>(null);

const WEB_KINDS = ['overview', 'fees', 'eligibility', 'terms', 'bundle'] as const;
const NON_PAGE_URL = /\.(?:pdf|json|xml|ya?ml|csv|rss|atom|txt)\/?$|(?:^|\/)(?:feed|rss|atom)(?:\/|$)/i;
const LANDING_PATH = /^\/(?:index\.(?:html?|php)\/?|home\/?|(?:en|en-au)\/?)?$/i;

/** A web page the app may open: not a document, feed or API host, and a landing page only when allowed. */
function pageUrl(url: string, allowLanding: boolean): string | null {
  const result = trustedExternalUrl({ url, purpose: 'lender_source', label: 'Product' });
  if (!result.ok) return null;
  let hostname: string, pathname: string;
  try { ({ hostname, pathname } = new StandardUrl(result.url)); pathname = decodeURIComponent(pathname); } catch { return null; }
  if (NON_PAGE_URL.test(pathname) || /^(?:apis?|cdr|cds|open-?banking)[.-]/i.test(hostname)
    || /(?:^|\/)(?:apis?|cds-au|open-?banking)(?:\/|$)/i.test(pathname)) return null;
  if (!allowLanding && LANDING_PATH.test(pathname)) return null;
  return result.url;
}

/** The lender's own web page for the product: the product overview when it is a
 * real page, otherwise any other approved lender link, otherwise the overview
 * even when it is a landing page. Documents, feeds and API hosts never qualify. */
export function productWebUrl(links: ProductDetail['links'] | undefined, preferred: string | null): string | null {
  if (preferred) return preferred;
  const candidates = WEB_KINDS.flatMap(kind => links?.[kind] ? [links[kind] as string] : []);
  for (const allowLanding of [false, true]) for (const url of candidates) {
    const page = pageUrl(url, allowLanding);
    if (page) return page;
  }
  return null;
}

/** A product with no lender links (public-only) falls back to the page its rate was read from, shown as a source. */
export function productSourceUrl(url: string | null | undefined): string | null {
  return url ? pageUrl(url, false) ?? pageUrl(url, true) : null;
}

export function ProductPageLinks({ overview, productDetails, fallbackUrl, children }: { overview?: string; productDetails?: ProductDetail | null; fallbackUrl?: string | null; children: UiChild }) {
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
    // A published overview can still be a bank landing page, document, feed or API.
    if (LANDING_PATH.test(path) || NON_PAGE_URL.test(path)
      || /^(?:apis?|cdr|cds|open-?banking)[.-]/i.test(hostname)
      || /(?:^|\/)(?:apis?|cds-au|open-?banking)(?:\/|$)/i.test(path)) return null;
    return result.url;
  }, [overview]);
  const target = useMemo<ProductWebTarget | null>(() => {
    const provider = productWebUrl(productDetails?.links ?? (overview ? { overview } : undefined), link);
    if (provider) return { url: provider, kind: 'provider' };
    const source = productSourceUrl(fallbackUrl);
    return source ? { url: source, kind: 'source' } : null;
  }, [productDetails?.links, overview, link, fallbackUrl]);
  useAuditExternalLinks(target ? [{ url: target.url, purpose: 'lender_source', label: 'Product' }] : []);
  return <ProductPageContext.Provider value={productDetails ?? null}><ProductWebContext.Provider value={target}>{children}</ProductWebContext.Provider></ProductPageContext.Provider>;
}

/** Opens the lender's product page, or the page its rate was read from. Hidden only when neither is usable. */
export function ProductWebLink() {
  const target = useContext(ProductWebContext);
  const { requestExternalUrl } = useTrustedExternalUrl();
  if (!target) return null;
  return <Row style={{ marginBottom: 12 }}><Button title={target.kind === 'provider' ? 'Provider website' : 'Source page'} variant="secondary" icon="open-outline"
    onPress={() => requestExternalUrl({ url: target.url, purpose: 'lender_source', label: 'Product' })} /></Row>;
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
