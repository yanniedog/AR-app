/** Private admitted source documents, with bounded literal pages and no calculation authority. */
import { SECTION_KEYS } from '../types';
import type { AppState } from './storeTypes';
import type { EvidenceLane } from './productEvidencePublication';
import { createPublishedProductEvidence } from './productEvidencePublicationTransport';
import { EvidenceError, type EvidenceFact } from './productEvidenceWire';
import { verifiedCoreContents } from './sectionIntegrity';
import { verifiedCatalogueDetails } from './detailsCatalogue';
import { productEvidenceTextSlice } from './productEvidencePagination';

export type ProductEvidenceContext = Pick<AppState, 'manifest' | 'core' | 'coreIntegrity' | 'details' | 'productEvidenceHead' | 'source'>;
export interface ProductEvidenceDocument {
  readonly kind: 'facts' | 'response'; readonly records: number; readonly facts: number | null;
  readonly observedDate: string; readonly observationState: 'complete' | 'partial' | 'failed';
  readonly edition: string;
  readonly bodySha256: string | null; readonly bodyMatchesExport: boolean; readonly productKey: string;
  readonly bodyRole: 'detail' | 'index' | null;
  readonly responseState: string | null;
}
export interface ProductEvidencePage { readonly record: number; readonly records: number; readonly page: number;
  readonly pages: number; readonly start: number; readonly end: number; readonly characters: number }
type Contents = { facts?: EvidenceFact[]; text?: string; current?: { record: number; text: string } };
const documents = new WeakMap<ProductEvidenceDocument, Contents>(), pages = new WeakMap<ProductEvidencePage, string>();
export interface ProductEvidenceBodyChoice { sha256: string; role: 'detail' | 'index'; matchesExport: boolean }
export type ProductEvidenceOutcome = { status: 'observed'; document: ProductEvidenceDocument; bodies: ProductEvidenceBodyChoice[] }
  | { status: 'unavailable' | 'unsupported' | 'unknown'; reason?: string; routeState?: string; bodies?: ProductEvidenceBodyChoice[] };

export function verifyEvidenceProduct(context: ProductEvidenceContext, productKey: string): void {
  const { core, coreIntegrity: integrity, manifest, details, productEvidenceHead: head } = context;
  if (!core || !manifest || !head || context.source === 'sample' || integrity?.core !== core
      || integrity.coreSha256 !== manifest.files.core.sha256 || integrity.runDate !== manifest.run_date
      || core.run_date !== manifest.run_date || !verifiedCoreContents(integrity)) throw new EvidenceError('unavailable', 'Current product source is unverified');
  const known = SECTION_KEYS.some(section => core.sections[section].rates.some(row => row.product_key === productKey));
  const catalogue = verifiedCatalogueDetails(core, integrity, manifest, details);
  if (!known && !(catalogue && Object.hasOwn(catalogue.products, productKey))) throw new EvidenceError('unavailable', 'Product is absent from the verified catalogue');
}

export async function loadProductEvidenceDocument(context: ProductEvidenceContext, productKey: string,
  lane: EvidenceLane, isCurrent: () => boolean, signal: AbortSignal, bodySha?: string): Promise<ProductEvidenceOutcome> {
  if (!context.manifest || !Object.hasOwn(context.manifest, lane)) return { status: 'unavailable' };
  verifyEvidenceProduct(context, productKey);
  const reader = createPublishedProductEvidence({ manifest: context.manifest, selected: context.productEvidenceHead!, isCurrent });
  const result = lane === 'product_evidence_v1' ? await reader.readFacts(productKey, signal) : await reader.readResponse(productKey, { signal, bodySha });
  if (signal.aborted || !isCurrent()) throw new EvidenceError('cancelled', 'Evidence selection changed');
  verifyEvidenceProduct(context, productKey);
  const route = 'route' in result ? result.route : null;
  const bodies: ProductEvidenceBodyChoice[] = route ? [...route.details.map(item => ({ sha256: item.sha256, role: 'detail' as const, matchesExport: item.matches_export })),
    ...route.indexes.map(sha256 => ({ sha256, role: 'index' as const, matchesExport: false }))] : [];
  if (result.status !== 'observed') return { status: result.status, bodies, ...('reason' in result ? { reason: result.reason } : {}),
    ...(route ? { routeState: route.state } : {}) };
  const facts = 'facts' in result ? result.facts : undefined, body = 'text' in result ? result : null;
  const source = 'facts' in result.binding ? result.binding.facts.source : result.binding.source;
  const document: ProductEvidenceDocument = Object.freeze({ kind: facts ? 'facts' : 'response', records: Math.max(1, facts?.length ?? 1),
    facts: facts?.length ?? null, observedDate: source.observation_date, observationState: source.observation_state,
    edition: context.manifest.payload_revision!.bundle_sha256,
    bodySha256: body?.body.sha256 ?? null, bodyMatchesExport: body?.currentMatchesExport ?? false, bodyRole: body?.role ?? null,
    responseState: route?.state ?? null, productKey });
  documents.set(document, facts ? { facts } : { text: body!.text });
  return { status: 'observed', document, bodies };
}

/** No strings enter this boundary without an admitted private document. */
export function productEvidencePage(document: ProductEvidenceDocument, record = 0, page = 0): ProductEvidencePage {
  const content = documents.get(document);
  if (!content || !Number.isSafeInteger(record) || record < 0 || record >= document.records) throw new EvidenceError('invalid', 'Evidence record is not admitted');
  if (content.facts && content.current?.record !== record) content.current = { record, text: JSON.stringify(content.facts[record] ?? [], null, 2) };
  const text = content.facts ? content.current!.text : content.text!;
  const slice = productEvidenceTextSlice(text, page), { text: contentText, ...position } = slice;
  const handle = Object.freeze({ record, records: document.records, ...position });
  pages.set(handle, contentText); return handle;
}
export function productEvidencePageText(page: ProductEvidencePage): string {
  const text = pages.get(page);
  if (text === undefined) throw new EvidenceError('invalid', 'Evidence page is not admitted');
  return text;
}
