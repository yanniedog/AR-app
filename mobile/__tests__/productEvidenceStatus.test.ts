import { statusSelection } from '../testUtils/productEvidenceStatusSelection';
import { evidenceSelection } from '../testUtils/productEvidenceSelection';
import { EVIDENCE_STATUS_REASONS, type EvidenceDeliveryState } from '../src/data/productEvidenceStatus';
import { validateEvidencePublication, validateOptionalEvidencePublication } from '../src/data/productEvidencePublication';
import { createPublishedProductEvidence } from '../src/data/productEvidencePublicationTransport';
import { selectedProductEvidenceHead } from '../src/data/historyDatesIndex';
import { resolveFinalizedManifest } from '../src/data/ingestFinalized';
import { loadProductEvidenceDocument } from '../src/data/productEvidenceDocument';
import { downloadInflate } from '../src/data/payload';

jest.mock('../src/data/payload', () => ({ downloadInflate: jest.fn(), fetchManifest: jest.fn() }));
beforeEach(() => jest.mocked(downloadInflate).mockReset());

test.each(Object.keys(EVIDENCE_STATUS_REASONS) as EvidenceDeliveryState[])('%s survives actual finalized/cached metadata admission with no evidence IO', async state => {
  const p = statusSelection(state);
  expect(validateEvidencePublication(p.manifest, p.head).availability.product_evidence_v1).toMatchObject({ state });
  expect(selectedProductEvidenceHead(JSON.parse(JSON.stringify(p.dates)), JSON.parse(JSON.stringify(p.manifest)))).toEqual(p.head);
  const result = await resolveFinalizedManifest(p.manifest, { fetchIndex: async () => p.dates, fetchRevision: async () => p.manifest });
  expect(result.manifest).toBe(p.manifest); expect(downloadInflate).not.toHaveBeenCalled();
});
test.each(['disabled', 'pending', 'failed', 'unavailable', 'unsupported'] as const)('%s returns truthful status without downloading capabilities/details', async state => {
  const p = statusSelection(state), result = await loadProductEvidenceDocument(p.context, p.key, 'product_evidence_v1', () => true, new AbortController().signal);
  expect(result).toMatchObject({ status: state, reason: EVIDENCE_STATUS_REASONS[state][0] });
  expect(downloadInflate).not.toHaveBeenCalled();
});
test('legacy references are explicitly unreported; validated body access remains backward compatible', async () => {
  const p = evidenceSelection(); jest.mocked(downloadInflate).mockImplementation(p.load);
  expect(validateEvidencePublication(p.manifest,p.head).availability.product_evidence_v1.state).toBe('unreported');
  const result = await loadProductEvidenceDocument(p.context,p.key,'product_evidence_v1',()=>true,new AbortController().signal);
  expect(result.status).toBe('observed'); if (result.status==='observed') expect(result.document.availability).toBe('unreported');
});
test.each(['missing-reference','pending-reference','source','reason','unknown-state','null-status','extra-lane'])('malformed known status %s blocks adoption before IO', fault => {
  const p = statusSelection(); const status = p.manifest.optional_product_evidence_status!;
  if (fault==='missing-reference') delete p.manifest.product_evidence_v1;
  else if (fault==='pending-reference') status.lanes.product_evidence_v1={ state:'pending', reason:'not_prepared' };
  else if (fault==='source') status.source.contract_digest='0'.repeat(64);
  else if (fault==='reason') status.lanes.product_evidence_v1.reason='source_unavailable';
  else if (fault==='unknown-state') (status.lanes.product_evidence_v1 as {state:string}).state='future';
  else if (fault==='null-status') (p.manifest as unknown as Record<string,unknown>).optional_product_evidence_status=null;
  else (status.lanes as unknown as Record<string,unknown>).future={state:'available',reason:'verified'};
  p.seal(); expect(()=>validateOptionalEvidencePublication(p.manifest,p.head)).toThrow();
  expect(selectedProductEvidenceHead(p.dates,p.manifest)).toBeNull();expect(downloadInflate).not.toHaveBeenCalled();
});
test('unknown delivery schema is unsupported and never downloads a previously understood reference', async () => {
  const p=statusSelection();p.manifest.optional_product_evidence_status!.schema='ar-product-evidence-status-v999';p.seal();
  const reader=createPublishedProductEvidence({manifest:p.manifest,selected:p.head,isCurrent:()=>true});
  await expect(reader.readFacts(p.key)).resolves.toMatchObject({status:'unsupported',absenceIsWithdrawal:false});
  expect(downloadInflate).not.toHaveBeenCalled();
});
test('ready status never hides an unavailable/corrupt transport or claims zero facts', async () => {
  const p=statusSelection();jest.mocked(downloadInflate).mockRejectedValueOnce(new Error('HTTP404'));
  await expect(loadProductEvidenceDocument(p.context,p.key,'product_evidence_v1',()=>true,new AbortController().signal)).rejects.toThrow('HTTP404');
  jest.mocked(downloadInflate).mockImplementation(p.load);
  const result=await loadProductEvidenceDocument(p.context,p.key,'product_evidence_v1',()=>true,new AbortController().signal);
  expect(result.status).toBe('observed');if(result.status==='observed')expect(result.document.availability).toBe('available');
});
test('metadata availability is cloned and does not grant detached source/product membership', async () => {
  const p=statusSelection('pending');const reader=createPublishedProductEvidence({manifest:p.manifest,selected:p.head,isCurrent:()=>true});
  reader.availability.product_evidence_v1.state='available';
  await expect(reader.readFacts(p.key)).resolves.toMatchObject({status:'pending'});
  await expect(loadProductEvidenceDocument({...p.context,productEvidenceHead:null},p.key,'product_evidence_v1',()=>true,new AbortController().signal)).rejects.toThrow('unverified');
  expect(downloadInflate).not.toHaveBeenCalled();
});
