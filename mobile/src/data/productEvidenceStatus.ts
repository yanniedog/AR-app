/** Public lane availability only; never imports private producer preparation receipts. */
import type { Manifest } from '../types';
import { isValidCalendarDate } from '../lib/calendarDate';
import { responseFields, responseRequire, responseSha } from './productResponseWire';
import type { EvidenceLane, EvidenceReferenceState } from './productEvidencePublication';

export const EVIDENCE_STATUS_SCHEMA = 'ar-product-evidence-status-v1';
export const EVIDENCE_STATUS_REASONS = {
  disabled: ['disabled_by_configuration'], pending: ['not_prepared'],
  unavailable: ['source_unavailable', 'source_failed', 'source_superseded', 'source_unverified'],
  unsupported: ['unsupported_source_schema'], failed: ['preparation_failed', 'budget_exceeded'],
  available: ['verified'],
} as const;
export type EvidenceDeliveryState = keyof typeof EVIDENCE_STATUS_REASONS;
export interface EvidenceReferenceSource { generation_id: string; observation_date: string;
  observation_state: 'complete' | 'partial' | 'failed'; contract_digest: string }
export interface EvidenceLaneStatus { state: EvidenceDeliveryState | 'unreported'; reason?: string }
export interface EvidenceDeliveryStatus { schema: string; source: EvidenceReferenceSource;
  lanes: Record<EvidenceLane, { state: EvidenceDeliveryState; reason: string }> }
const lanes = ['product_evidence_v1', 'product_response_evidence_v1'] as const;

export function validateEvidenceSource(value: unknown, manifest: Manifest): EvidenceReferenceSource {
  const source = responseFields(value, ['generation_id', 'observation_date', 'observation_state', 'contract_digest']);
  responseRequire(typeof source.observation_date === 'string' && isValidCalendarDate(source.observation_date)
    && source.observation_date === manifest.run_date && typeof source.generation_id === 'string'
    && new RegExp(`^obs-${source.observation_date}-[a-f0-9]{16}$`).test(source.generation_id)
    && typeof source.observation_state === 'string' && ['complete', 'partial', 'failed'].includes(source.observation_state)
    && responseSha(source.contract_digest), 'Invalid evidence source reference');
  responseRequire(Object.entries(source).every(([key, field]) => manifest.source_observation?.[key] === field), 'Evidence selected source mismatch');
  return source as unknown as EvidenceReferenceSource;
}

/** Called only after the complete manifest has passed bounded JSON/selected-head admission. */
export function validateEvidenceStatuses(manifest: Manifest, refs: Record<EvidenceLane, EvidenceReferenceState>): Record<EvidenceLane, EvidenceLaneStatus> {
  const value = manifest.optional_product_evidence_status;
  if (value === undefined) return Object.fromEntries(lanes.map(lane => [lane, { state: 'unreported' }])) as Record<EvidenceLane, EvidenceLaneStatus>;
  if (value && typeof value === 'object' && typeof value.schema === 'string' && value.schema !== EVIDENCE_STATUS_SCHEMA) {
    return Object.fromEntries(lanes.map(lane => [lane, { state: 'unsupported', reason: 'unsupported_delivery_schema' }])) as Record<EvidenceLane, EvidenceLaneStatus>;
  }
  const envelope = responseFields(value, ['schema', 'source', 'lanes']);
  responseRequire(envelope.schema === EVIDENCE_STATUS_SCHEMA, 'Invalid evidence delivery status schema');
  validateEvidenceSource(envelope.source, manifest);
  const states = responseFields(envelope.lanes, [...lanes]), accepted = {} as Record<EvidenceLane, EvidenceLaneStatus>;
  for (const lane of lanes) {
    const status = responseFields(states[lane], ['state', 'reason']);
    responseRequire(typeof status.state === 'string' && Object.hasOwn(EVIDENCE_STATUS_REASONS, status.state)
      && typeof status.reason === 'string' && (EVIDENCE_STATUS_REASONS[status.state as EvidenceDeliveryState] as readonly string[]).includes(status.reason),
    'Invalid evidence delivery state/reason');
    responseRequire((status.state === 'available') === (refs[lane].status !== 'absent'), 'Evidence availability/reference contradiction');
    accepted[lane] = { state: status.state as EvidenceDeliveryState, reason: status.reason as string };
  }
  return accepted;
}
