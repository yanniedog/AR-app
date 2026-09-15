import type { CorePayload, Manifest, ManifestFile, RateRow } from '../../types';
import type { CoreIntegrityContext } from '../sectionIntegrity';
import { PAYLOAD_REPO } from '../../config';
import { downloadInflate } from '../payload';
import { canonical, hashText } from '../../lib/productTermsEngine/validation';
import { Decimal } from '../../lib/productTermsEngine/decimal';
import { validateAsset } from './validation';
import type { ExecutableAsset, ExecutableTemplate } from './types';
export interface ContractContext { manifest: Manifest | null; core: CorePayload | null; coreIntegrity: CoreIntegrityContext | null }
export interface ApprovedSelection { readonly template: ExecutableTemplate; readonly approval: ExecutableAsset['templates'][number]['approval']; readonly edition: string }
type Binding = { context: ContractContext; row: RateRow; manifestIdentity: string; contentIdentity: string; assetSha: string };
const bindings = new WeakMap<ApprovedSelection, Binding>();
const manifestIdentity = (m: Manifest) => hashText(canonical(m));
function verified(context: ContractContext, row: RateRow) {
  const { manifest: m, core: c, coreIntegrity: i } = context;
  if (!m?.payload_revision || m.repo !== PAYLOAD_REPO || !c || !i || i.core !== c || i.runDate !== c.run_date || c.run_date !== m.run_date || i.coreSha256 !== m.files.core.sha256 || !c.sections.TD.rates.includes(row)) throw new Error('Selected rate publication is not verified');
  return { m, c };
}
function file(m: Manifest, key: string): ManifestFile | undefined { const files = m.files as unknown as Record<string, ManifestFile>; return Object.hasOwn(files, key) ? files[key] : undefined; }
async function acquire(m: Manifest, f: ManifestFile, max: number): Promise<any> {
  if (!f || !/^[a-f0-9]{64}$/.test(f.sha256) || !/^[A-Za-z0-9_.-]+$/.test(f.name) || f.enc !== undefined || !Number.isSafeInteger(f.bytes) || f.bytes <= 0 || f.bytes > max || f.url !== `https://github.com/${PAYLOAD_REPO}/releases/download/${m.tag}/${f.name}`) throw new Error('Invalid executable descriptor');
  return JSON.parse(await downloadInflate(f.url, f.sha256, { fileName: f.name, expectedBytes: f.bytes, requireExactBytes: true, maxCompressedBytes: max, maxInflatedBytes: max, allowEncrypted: false }));
}
function envelope(v: any, m: Manifest, limit: number) {
  if (!v || Object.keys(v).some(k => !['schema_version','run_date','core_asset_sha256','products'].includes(k)) || v.schema_version !== 1 || v.run_date !== m.run_date || v.core_asset_sha256 !== m.files.core.sha256 || !v.products || typeof v.products !== 'object' || Array.isArray(v.products) || Object.keys(v.products).length > limit) throw new Error('Executable publication mismatch');
}
/** Only verified immutable transport creates handles. Evidence-stage flags cannot mint approval. */
export async function loadExecutableSelections(context: ContractContext, row: RateRow): Promise<ApprovedSelection[]> {
  const { m, c } = verified(context, row), editionIdentity = manifestIdentity(m), descriptor = file(m, 'executable_index');
  if (!descriptor) return [];
  const index = await acquire(m, descriptor, 512 * 1024); envelope(index, m, 20000);
  for (const key of Object.values(index.products)) if (typeof key !== 'string' || !/^executable_shard_[0-9]{3}$/.test(key) || !file(m, key)) throw new Error('Invalid executable index');
  const key = Object.hasOwn(index.products, row.product_key) ? index.products[row.product_key] : undefined;
  if (!key) return [];
  const shardFile = file(m, key)!, shard = await acquire(m, shardFile, 512 * 1024); envelope(shard, m, 20000);
  if (!Object.hasOwn(shard.products, row.product_key)) throw new Error('Executable product missing');
  const asset = validateAsset(shard.products[row.product_key]);
  if (asset.productKey !== row.product_key || asset.runDate !== m.run_date || asset.coreAssetSha256 !== m.files.core.sha256 || asset.sourceGenerationId !== m.source_observation?.generation_id || manifestIdentity(m) !== editionIdentity) throw new Error('Executable edition changed');
  return asset.templates.filter(({ template: t }) => t.selectedRate.coreRowIndex === c.sections.TD.rates.indexOf(row) && t.selectedRate.rateIndex === row.rate_index).map(entry => {
    const t = entry.template;
    if (row.rate_type !== 'FIXED' || hashText(canonical(row)) !== t.selectedRate.rowSha256 || Decimal.parse(String(row.rate)).compare(Decimal.parse(t.annualRate)) !== 0 || row.term !== `P${t.term.count}${t.term.unit === 'days' ? 'D' : 'M'}`) throw new Error('Exact rate variant does not match template');
    for (const [field, bound] of [['balance_min', t.principalBounds.minimum], ['balance_max', t.principalBounds.maximum]] as const) {
      const value = row[field];
      if (value !== undefined && value !== null && value !== '') {
        if (!('value' in bound) || Decimal.parse(String(value)).compare(Decimal.parse(bound.value)) !== 0) throw new Error('Published principal bounds do not match source contract');
      }
    }
    const selected: ApprovedSelection = { ...entry, edition: m.run_date };
    bindings.set(selected, { context, row, manifestIdentity: editionIdentity, contentIdentity: hashText(canonical(selected)), assetSha: shardFile.sha256 }); return selected;
  });
}
/** Recheck adoption and content on every calculation; same core never preserves removed approval. */
export function assertSelection(selection: ApprovedSelection, current: ContractContext, row: RateRow): string[] {
  verified(current, row); const b = bindings.get(selection);
  if (!b || b.row !== row || b.context.core !== current.core || b.manifestIdentity !== manifestIdentity(current.manifest!) || b.contentIdentity !== hashText(canonical(selection)) || hashText(canonical(row)) !== selection.template.selectedRate.rowSha256 || current.core!.sections.TD.rates[selection.template.selectedRate.coreRowIndex] !== row) throw new Error('Executable approval is unavailable in this adopted edition');
  return [b.manifestIdentity, b.assetSha, selection.template.id, selection.approval.reviewId, selection.approval.benchmarkResultSha256];
}
