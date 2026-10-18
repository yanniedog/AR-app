import { AuditDatasetChangedError, prepareAuditPublicCore, assertAuditPublicCataloguePinned } from '../src/lib/performanceAuditDataset';
import { publicOfferSelectionToken } from '../src/data/publicOfferIdentity';
import { normalizeUserRateScenario } from '../src/data/userRateScenario';
import { normalizeProfileFilters } from '../src/data/profile';
import { catalogue, core } from '../testUtils/publicRateJourney';
import { buildPerformanceAuditSetupPlans } from '../src/lib/performanceAuditSetup';
import { installMandatoryEligibility } from '../src/data/eligibilityGate';

const scenario = normalizeUserRateScenario(undefined), profile = normalizeProfileFilters(undefined);
beforeEach(() => installMandatoryEligibility({ active: false, loading: false, rows: new WeakSet(), productKeys: new Set() }));

test.each(['loading', 'error', 'partial'] as const)('unsettled %s catalogue cannot produce a legacy plan that later silently changes identity', state => {
  const view = { ...catalogue(), status: state === 'partial' ? 'ready' as const : state, allLoaded: state !== 'partial' };
  expect(() => prepareAuditPublicCore(core(), view, scenario, profile)).toThrow('not settled');
  const ready = catalogue();
  const plan = buildPerformanceAuditSetupPlans(prepareAuditPublicCore(core(), ready, scenario, profile), { includeNonStandard: true });
  expect(plan.plan.inputs.primaryProduct?.selectionToken).toBe(publicOfferSelectionToken('UNIT|LOAN', 'unit-offer'));
});

test('same-generation/count shard adoption invalidates the pinned audit while the original snapshot stays valid', () => {
  const pinned = { ...catalogue(), generationId: 'same-generation' };
  expect(() => assertAuditPublicCataloguePinned(pinned, pinned)).not.toThrow();
  const replacement = { ...pinned };
  expect(replacement.products).toBe(pinned.products);
  expect(() => assertAuditPublicCataloguePinned(pinned, replacement)).toThrow(AuditDatasetChangedError);
  expect(() => assertAuditPublicCataloguePinned({ ...pinned, status: 'loading' }, pinned)).toThrow(AuditDatasetChangedError);
});

test('absent manifest capability retains the original raw core and never adopts another catalogue snapshot', () => {
  const source = core();
  expect(prepareAuditPublicCore(source, null, scenario, profile)).toBe(source);
  expect(() => assertAuditPublicCataloguePinned(null, catalogue())).toThrow(AuditDatasetChangedError);
});

test.each([false, true])('presence-only changes do not invent a generation change (adding: %s)', adding => {
  const unavailable = { ...catalogue(), status: 'unavailable' as const, generationId: null };
  try {
    assertAuditPublicCataloguePinned(adding ? null : unavailable, adding ? unavailable : null);
    throw new Error('Expected a catalogue presence change');
  } catch (error) {
    expect(error).toBeInstanceOf(AuditDatasetChangedError);
    expect((error as AuditDatasetChangedError).evidence).toMatchObject({
      publicCatalogueChanged: true, catalogueGenerationChanged: false,
      expectedCataloguePresent: !adding, actualCataloguePresent: adding,
    });
  }
});

test('actual catalogue generations remain distinguishable in structured evidence', () => {
  try {
    assertAuditPublicCataloguePinned({ ...catalogue(), generationId: 'old' }, { ...catalogue(), generationId: 'new' });
    throw new Error('Expected a generation change');
  } catch (error) {
    expect(error).toBeInstanceOf(AuditDatasetChangedError);
    expect((error as AuditDatasetChangedError).evidence.catalogueGenerationChanged).toBe(true);
  }
});
