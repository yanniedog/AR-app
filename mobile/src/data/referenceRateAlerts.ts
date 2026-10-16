import { uiJoin, uiPublicReferenceName, uiRate } from '../lib/uiCopy';
import { Platform } from 'react-native';
import type { Manifest } from '../types';
import { SECURE_STORE_KEYS } from '../lib/secureStoreKey';
import { readSecureStoreValue, writeSecureStoreValue } from '../lib/secureStoreValue';
import { ensurePublicRateCatalogueLoaded } from './publicRateCatalogue';
import { rateDecimal, Decimal, decimalText } from './publicRateDecimal';
import { publicRateFreshness } from './publicRateResolver';
import { selectPublicReference } from './publicRateLocal';
import { publicReferenceScope } from './publicRatePresentation';
import type { PublicReferenceRate } from './publicRateModel';
import { notify, type NotifyMessage } from './notifications';
import { loadUserRateScenario, type UserRateScenario } from './userRateScenario';

export type ReferenceAlertBaseline = Record<string, { fraction: string; effectiveFrom?: string }>;

/** Only public reference movements are described; negotiated customer rates are never inferred. */
export function referenceRateChanges(scenario: UserRateScenario, references: readonly PublicReferenceRate[],
  previous: ReferenceAlertBaseline, thresholdBps = 1, asOf = new Date().toISOString()): {
    messages: NotifyMessage[]; baseline: ReferenceAlertBaseline;
  } {
  const messages: NotifyMessage[] = [], baseline: ReferenceAlertBaseline = {};
  const selected = new Set(Object.values(scenario.localRates).filter(local => local.mode === 'reference' && local.referenceChangeAlerts).map(local => local.referenceId));
  for (const id of selected) {
    const reference = selectPublicReference(references, id, asOf).reference;
    if (!reference || reference.value == null || publicRateFreshness(reference.freshness, asOf).state !== 'current') {
      if (previous[id]) baseline[id] = previous[id]; continue;
    }
    let fraction: string;
    try { fraction = decimalText(rateDecimal(reference.value!, reference.unit)); } catch { continue; }
    const prior = previous[id];
    baseline[id] = { fraction, ...(reference.effectiveFrom ? { effectiveFrom: reference.effectiveFrom } : {}) };
    if (!prior || prior.fraction === fraction) continue;
    try {
      const change = Decimal.parse(fraction).sub(Decimal.parse(prior.fraction));
      const threshold = Decimal.parse(String(Number.isFinite(thresholdBps) && thresholdBps >= 0 ? thresholdBps : 1)).div(Decimal.parse('10000'));
      const magnitude = change.compare(Decimal.parse('0')) < 0 ? Decimal.parse('0').sub(change) : change;
      if (magnitude.compare(threshold) < 0) continue;
      messages.push({ title: uiJoin('Public reference', ' · ', 'Rate changed'),
        body: uiJoin(uiPublicReferenceName(reference), ' · ', publicReferenceScope(reference), ' · ', 'Public reference', ': ', uiRate(Number(prior.fraction)), ' → ', uiRate(Number(fraction)), ' · ', 'Local reference estimate', ' · ', 'Charged rate', ': ', 'Unverified'),
        href: 'arrates://calculator',
      });
    } catch { /* Invalid retained public metadata cannot produce an alert. */ }
  }
  return { messages, baseline };
}

/** Existing refresh calls this; it neither creates a schedule nor writes private scenario inputs. */
export async function checkPublicReferenceChanges(manifest: Manifest | null, thresholdBps: number, isCurrent: () => boolean = () => true): Promise<void> {
  if (Platform.OS === 'web' || !manifest?.public_rate_catalogue) return;
  const scenario = await loadUserRateScenario();
  if (!Object.values(scenario.localRates).some(local => local.mode === 'reference' && local.referenceChangeAlerts)) return;
  const catalogue = await ensurePublicRateCatalogueLoaded(manifest);
  if (catalogue.status !== 'ready' || !catalogue.allLoaded || !isCurrent()) return;
  const raw = await readSecureStoreValue(SECURE_STORE_KEYS.referenceRateAlertBaseline);
  let previous: ReferenceAlertBaseline = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : undefined;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [id, item] of Object.entries(parsed)) {
        if (!item || typeof item !== 'object' || typeof (item as { fraction?: unknown }).fraction !== 'string') continue;
        const value = item as { fraction: string; effectiveFrom?: unknown };
        try {
          Decimal.parse(value.fraction);
          previous[id] = { fraction: value.fraction, ...(typeof value.effectiveFrom === 'string' ? { effectiveFrom: value.effectiveFrom } : {}) };
        } catch { /* Ignore malformed retained public metadata. */ }
      }
    }
  } catch { /* Reinitialize a public metadata baseline. */ }
  // Respect a watch being disabled while the bounded public download was in progress.
  const latestScenario = await loadUserRateScenario();
  const result = referenceRateChanges(latestScenario, catalogue.references, previous, thresholdBps);
  if (!isCurrent()) return;
  await notify(result.messages);
  // Baseline is separate from userRateScenario: a public refresh can never overwrite entered rates or discounts.
  if (isCurrent()) await writeSecureStoreValue(SECURE_STORE_KEYS.referenceRateAlertBaseline, JSON.stringify(result.baseline));
}
