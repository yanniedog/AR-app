import type { CorePayload, ProductDetail, RateRow } from '../types';
import type { UserRateScenario } from './userRateScenario';
import type { ProfileFilters } from './profile';
import type { PublicCatalogueView } from './publicRateIntegration';
import { publicComparisonCore, publicRateScenario, resolveRowPublicRate } from './publicRateIntegration';
import { Decimal } from './publicRateDecimal';
import { resolvePublicRate } from './publicRateResolver';
import type { SavedRateRef } from './savedRates';
import { largestRateChange, rowsForSearchSubscription, trackedRateValue, type Subscription, type TrackedRateValue } from './subscriptions';
import { profileFilterRows } from './profile';
import { formatRate } from './format';
import type { MortgageRateMetric, RankMetric } from './selectors';
import type { NotifyMessage } from './notifications';

/** Stable programmes and matched assumptions replace source-array-index comparisons. */
export function resolvedRateNotificationChanges({ previous, current, oldCore, newCore, saved, subscriptions, scenario, profile, thresholdBps,
  oldDetailsProducts, newDetailsProducts, depositRankMetric = 'base', mortgageRateMetric = 'comparison',
  asOf = new Date().toISOString() }: {
  previous: PublicCatalogueView; current: PublicCatalogueView; oldCore: CorePayload | null; newCore: CorePayload;
  saved: readonly SavedRateRef[]; subscriptions: readonly Subscription[]; scenario: UserRateScenario; profile: ProfileFilters;
  thresholdBps: number; asOf?: string;
  oldDetailsProducts?: Record<string, ProductDetail> | null; newDetailsProducts?: Record<string, ProductDetail> | null;
  depositRankMetric?: RankMetric; mortgageRateMetric?: MortgageRateMetric;
}): NotifyMessage[] {
  if (!oldCore || previous.status !== 'ready' || current.status !== 'ready' || !previous.allLoaded || !current.allLoaded) return [];
  const watches = new Map<string, { productKey: string; offerId?: string; programmeId?: string }>();
  for (const subscription of subscriptions) if (subscription.kind === 'product') {
    if (subscription.rateIndex != null && !subscription.offerId) continue;
    watches.set(subscription.offerId ?? subscription.productKey, subscription);
  }
  for (const ref of saved) if (ref.offerId && subscriptions.some(subscription => subscription.kind === 'product' && subscription.offerId === ref.offerId)) watches.set(ref.offerId, ref);
  const messages: NotifyMessage[] = [];
  const threshold = Decimal.parse(String(Number.isFinite(thresholdBps) && thresholdBps >= 0 ? thresholdBps : 1)).div(Decimal.parse('10000'));
  for (const watch of watches.values()) {
    const oldProduct = previous.getProduct(watch.productKey), product = current.getProduct(watch.productKey);
    if (!oldProduct || !product || oldProduct.productId !== product.productId) continue;
    for (const programme of current.getProgrammes(product.productId)) {
      if (watch.offerId && programme.offerId !== watch.offerId || watch.programmeId && programme.programmeId !== watch.programmeId) continue;
      const oldProgramme = previous.getProgrammes(oldProduct.productId).find(item => item.programmeId === programme.programmeId && item.offerId === programme.offerId);
      if (!oldProgramme) continue;
      const bindingRow = (core: CorePayload, bindings?: { rateIndex: number }[]): RateRow | undefined =>
        core.sections[product.section].rates.find(row => row.product_key === watch.productKey && bindings?.some(binding => binding.rateIndex === row.rate_index));
      const assumptions = publicRateScenario(product.section, scenario, profile);
      const oldRate = resolvePublicRate(oldProgramme, { ...assumptions, allowHistorical: true }, oldProgramme.freshness.lastSuccessAt ?? asOf);
      const rate = resolvePublicRate(programme, assumptions, asOf);
      if (oldRate.status !== 'exact' || rate.status !== 'exact' || oldRate.payableRate == null || rate.payableRate == null || !rate.verifiedCurrent) continue;
      const change = Decimal.parse(rate.payableRate).sub(Decimal.parse(oldRate.payableRate));
      const magnitude = change.compare(Decimal.parse('0')) < 0 ? Decimal.parse('0').sub(change) : change;
      if (magnitude.compare(threshold) < 0 || magnitude.compare(Decimal.parse('0')) === 0) continue;
      const row = bindingRow(newCore, programme.sourceBindings);
      messages.push({ title: `${product.providerName} public product rate changed`,
        body: `${product.name}: ${(Number(oldRate.payableRate) * 100).toFixed(2)}% → ${(Number(rate.payableRate) * 100).toFixed(2)}% for the selected public scenario. This does not confirm your bank's charged rate.`,
        productKey: product.productKey, ...(row?.rate_index != null ? { rateIndex: row.rate_index } : {}),
      });
    }
  }
  if (subscriptions.some(subscription => subscription.kind === 'search')) {
    const rateCore = (source: CorePayload, catalogue: PublicCatalogueView, historical: boolean): CorePayload => {
      const result = publicComparisonCore(source, catalogue, section => publicRateScenario(section, scenario, profile));
      const sections = { ...result.sections };
      for (const section of ['Mortgage', 'Savings', 'TD'] as const) sections[section] = { ...result.sections[section], rates: result.sections[section].rates.flatMap(row => {
        const product = catalogue.getProduct(row.product_key);
        const programme = product ? catalogue.getProgrammes(product.productId).find(item => item.programmeId === row.public_programme_id && item.offerId === row.public_offer_id) : undefined;
        if (!programme) return [];
        const rate = resolveRowPublicRate(row, catalogue, { ...publicRateScenario(section, scenario, profile), allowHistorical: historical },
          historical ? programme.freshness.lastSuccessAt ?? asOf : asOf);
        return rate?.status === 'exact' && rate.verifiedCurrent && rate.payableRate != null ? [{ ...row, rate: rate.payableRate,
          ...(rate.comparisonRate ? { comparison_rate: rate.comparisonRate } : {}) }] : [];
      }) };
      return { ...result, sections };
    };
    const oldRates = rateCore(oldCore, previous, true), newRates = rateCore(newCore, current, false);
    for (const subscription of subscriptions) if (subscription.kind === 'search') {
      const map = (source: CorePayload, details?: Record<string, ProductDetail> | null): Map<string, TrackedRateValue> => {
        const selected = { ...source, sections: { ...source.sections, [subscription.section]: { ...source.sections[subscription.section],
          rates: profileFilterRows(source.sections[subscription.section].rates, profile, subscription.section, details) } } };
        return new Map(rowsForSearchSubscription(selected, subscription, details).filter(row => row.public_offer_id)
          .map(row => [`${row.product_key}:${row.public_offer_id}:${row.public_programme_id}`, trackedRateValue(row, subscription.section, depositRankMetric, mortgageRateMetric)]));
      };
      const hit = largestRateChange(map(oldRates, oldDetailsProducts), map(newRates, newDetailsProducts),
        Number.isFinite(thresholdBps) && thresholdBps >= 0 ? thresholdBps : 1);
      if (!hit) continue;
      const metric = trackedRateValue(hit.row, subscription.section, depositRankMetric, mortgageRateMetric).metric;
      messages.push({ title: 'Public search rate changed', body: `${hit.row.provider} ${hit.row.product_name}: ${formatRate(hit.from)} → ${formatRate(hit.to)} (${metric === 'comparison' ? 'published comparison rate' : metric === 'ranked' ? 'selected published rate metric' : 'public payable rate'}). This public scenario does not confirm your bank's charged rate.`,
        search: { section: subscription.section, path: subscription.path, subscriptionId: subscription.id, sort: subscription.sort, hierarchyScoped: subscription.hierarchyScoped } });
    }
  }
  return [...new Map(messages.map(message => [`${message.title}:${message.body}`, message])).values()];
}
