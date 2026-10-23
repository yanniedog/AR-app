import type { CorePayload } from '../types';
import type { ProfileFilters } from '../data/profile';
import type { UserRateScenario } from '../data/userRateScenario';
import { publicComparisonCore, publicRateScenario, type PublicCatalogueView } from '../data/publicRateIntegration';

export class AuditDatasetChangedError extends Error {
  constructor(message: string, readonly evidence: Record<string, number | boolean> = { datasetRevisionChanged: true }) {
    super(message); this.name = 'AuditDatasetChangedError';
  }
}

/** Structured causes survive public export without copying error text or identities. */
export function auditDatasetFailureMetrics(error: unknown): Record<string, number | boolean> {
  return error instanceof AuditDatasetChangedError ? { datasetChanged: true, ...error.evidence } : {};
}

/** Sampling must see the same adopted rows as the UI, never a partial shard set. */
export function prepareAuditPublicCore(core: CorePayload | null, catalogue: PublicCatalogueView | null,
  scenario: UserRateScenario, profile: ProfileFilters): CorePayload | null {
  if (catalogue && catalogue.status !== 'unavailable' && (catalogue.status !== 'ready' || !catalogue.allLoaded)) {
    throw new Error('Public pricing catalogue is not settled for audit sampling');
  }
  return core && catalogue ? publicComparisonCore(core, catalogue,
    section => publicRateScenario(section, scenario, profile)) : core;
}

/** Snapshots are immutable. Same-manifest shard adoption must invalidate a run. */
export function assertAuditPublicCataloguePinned(expected: PublicCatalogueView | null, actual: PublicCatalogueView | null): void {
  if (actual !== expected) throw new AuditDatasetChangedError('Public pricing catalogue changed during the performance audit', {
    publicCatalogueChanged: true,
    expectedCataloguePresent: expected != null, actualCataloguePresent: actual != null,
    expectedCatalogueReady: expected?.status === 'ready', actualCatalogueReady: actual?.status === 'ready',
    expectedCatalogueUnavailable: expected?.status === 'unavailable', actualCatalogueUnavailable: actual?.status === 'unavailable',
    expectedCatalogueAllLoaded: expected?.allLoaded === true, actualCatalogueAllLoaded: actual?.allLoaded === true,
    expectedCatalogueProducts: expected?.products.length ?? 0, actualCatalogueProducts: actual?.products.length ?? 0,
    catalogueGenerationChanged: (expected?.generationId ?? null) !== (actual?.generationId ?? null),
  });
}
