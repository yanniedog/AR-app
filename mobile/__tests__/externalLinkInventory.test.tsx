import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { useAuditExternalLinks } from '../src/hooks/useAuditExternalLinks';
import {
  beginExternalLinkCapture,
  captureExternalAuditLinks,
  collectExternalAuditLinks,
  endExternalLinkCapture,
  getCapturedExternalAuditLinks,
} from '../src/lib/externalLinkInventory';
import type { DetailsPayload } from '../src/types';
import type { TrustedExternalUrlRequest } from '../src/lib/trustedExternalUrl';

const target: TrustedExternalUrlRequest = { url: 'https://www.commbank.com.au/product?offer=1', purpose: 'lender_source', label: 'Lender product' };
function Source({ requests }: { requests: TrustedExternalUrlRequest[] }) {
  useAuditExternalLinks(requests);
  return null;
}

describe('external source inventory', () => {
  it('includes all product link kinds and original source documents with exact query preservation', () => {
    const details: DetailsPayload = { schema_version: 1, run_date: '2026-10-04', products: { product: {
      links: { overview: target.url, eligibility: 'https://www.commbank.com.au/eligibility', fees: 'https://www.commbank.com.au/fees', terms: 'https://www.commbank.com.au/terms', bundle: 'https://www.commbank.com.au/bundle' },
      sourceDocuments: [{ url: 'https://www.commbank.com.au/cleaned', sourceUrl: 'https://www.commbank.com.au/original?document=one', sourcePath: '/public', relation: 'fees' }],
    } } };
    const inventory = collectExternalAuditLinks({ details, releaseNotes: [{ version: '1.0.1', releaseUrl: 'https://github.com/yanniedog/AR-app/releases/tag/app-v1.0.1' }], observed: [target] });
    expect(inventory.filter((entry) => entry.purpose === 'lender_source')).toHaveLength(6);
    expect(inventory.some((entry) => entry.url.endsWith('/cleaned'))).toBe(false);
    expect(inventory.some((entry) => entry.url.endsWith('/original?document=one'))).toBe(true);
    expect(inventory.filter((entry) => entry.url === target.url)).toHaveLength(1);
    expect(inventory.some((entry) => entry.purpose === 'app_release')).toBe(true);
  });

  it('retains invalid sources for explicit validation failures and separates purposes', () => {
    const invalid = { ...target, url: 'http://unapproved.test/' };
    const inventory = collectExternalAuditLinks({ observed: [invalid, invalid, { ...invalid, purpose: 'app_release' }] });
    expect(inventory.filter((entry) => entry.url === invalid.url)).toHaveLength(2);
  });

  it('records mounted sources when capture begins, accumulates changes and retains them across unmount', async () => {
    let tree!: ReactTestRenderer;
    let handle: ReturnType<typeof beginExternalLinkCapture> | undefined;
    try {
      await act(async () => { tree = TestRenderer.create(<Source requests={[target]} />); });
      expect(getCapturedExternalAuditLinks()).toEqual([]);
      await act(async () => { handle = beginExternalLinkCapture(); });
      expect(getCapturedExternalAuditLinks()).toEqual([target]);
      const later = { ...target, url: 'https://www.commbank.com.au/new-source' };
      await act(async () => { tree.update(<Source requests={[later]} />); });
      act(() => tree.unmount());
      expect(getCapturedExternalAuditLinks()).toEqual([target, later]);
    } finally {
      if (handle) act(() => endExternalLinkCapture(handle!));
    }
    expect(getCapturedExternalAuditLinks()).toEqual([]);
  });

  it('resets between audits, ignores stale cleanup and does not retain sources outside capture', () => {
    const previous = beginExternalLinkCapture();
    captureExternalAuditLinks([target]);
    const current = beginExternalLinkCapture();
    expect(getCapturedExternalAuditLinks()).toEqual([]);
    captureExternalAuditLinks([target]);
    endExternalLinkCapture(previous);
    expect(getCapturedExternalAuditLinks()).toEqual([target]);
    endExternalLinkCapture(current);
    captureExternalAuditLinks([target]);
    expect(getCapturedExternalAuditLinks()).toEqual([]);
  });
});
