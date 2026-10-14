import { router } from 'expo-router';
import React, { useCallback, useMemo } from 'react';

import { EmptyState } from '../../src/components/feedback';
import { NavigationHub } from '../../src/components/NavigationHub';
import { ProductCard } from '../../src/components/ProductCard';
import { RbaCountdownCard } from '../../src/components/RbaCountdownCard';
import { LedgerAction, LedgerSection, LedgerText } from '../../src/components/ledger';
import { mandatoryEligibleRows, mandatoryProductAllowed } from '../../src/data/eligibilityGate';
import { profileFilterRows } from '../../src/data/profile';
import { resolveSavedRates, unresolvedSavedRateRefs } from '../../src/data/savedRates';
import { SAVED_EMPTY_COPY, savedEmptyState } from '../../src/lib/savedEmptyState';
import { bestRow } from '../../src/data/selectors';
import { useStore } from '../../src/data/store';
import { openProduct } from '../../src/lib/nav';
import { useSuitabilityRevision } from '../../src/hooks/useSuitabilityRevision';
import { usePublicRateCatalogue } from '../../src/data/publicRateCatalogue';
import { publicRateScenario, publicRecommendationRows, resolvedPublicRankingRows } from '../../src/data/publicRateIntegration';
import { useUserRateScenario } from '../../src/hooks/useUserRateScenario';
import { PublicPricingCoverage } from '../../src/components/scenario/PublicPricingCoverage';

const findRates = () => router.navigate('/(tabs)/browse');
const actions = { 'home.open': () => undefined, 'redirect.root.verify': () => undefined, 'home.rates.open': findRates };

const SAVED_PREVIEW = 3;

export default function Home() {
  const core = useStore((s) => s.core);
  const manifest = useStore((s) => s.manifest);
  const publicCatalogue = usePublicRateCatalogue(manifest);
  const { scenario } = useUserRateScenario();
  const savedRates = useStore((s) => s.savedRates);
  const interests = useStore((s) => s.prefs.interests);
  const profileFilters = useStore((s) => s.prefs.profileFilters);
  const details = useStore((s) => s.details);
  const includeNonStandard = useStore((s) => s.prefs.includeNonStandard);
  const depositRankMetric = useStore((s) => s.prefs.depositRankMetric);
  const mortgageRateMetric = useStore((s) => s.prefs.mortgageRateMetric);
  const suitabilityRevision = useSuitabilityRevision();
  const detailsProducts = details?.products ?? null;

  const saved = useMemo(
    () => (core ? resolveSavedRates(core, savedRates, publicCatalogue, section => publicRateScenario(section, scenario, profileFilters)).filter((item) => mandatoryEligibleRows([item.row]).length > 0) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- suitabilityRevision re-ranks on same-day corrections
    [core, savedRates, suitabilityRevision, publicCatalogue, scenario, profileFilters],
  );
  const savedUnavailable = useMemo(
    () => (core ? unresolvedSavedRateRefs(savedRates.filter((ref) => mandatoryProductAllowed(ref.productKey)), saved).length : 0),
    [core, savedRates, saved],
  );
  const savedEmpty = savedEmptyState({ savedCount: savedRates.length, unavailableCount: savedUnavailable });

  // Best rate in each product family the person follows, with their profile
  // applied — the "for you" numbers that make Home worth opening.
  const bestByType = useMemo(() => {
    void suitabilityRevision;
    if (!core) return [];
    return interests
      .map((section) => {
        const rows = publicRecommendationRows(core.sections[section]?.rates ?? [], publicCatalogue, section,
          publicRateScenario(section, scenario, profileFilters));
        const eligible = profileFilterRows(rows, profileFilters, section, detailsProducts);
        const pricing = resolvedPublicRankingRows(eligible, publicCatalogue, row => publicRateScenario(section, scenario, profileFilters, row));
        if (publicCatalogue.status !== 'unavailable' && !pricing.complete) return null;
        const row = bestRow(
          pricing.rows,
          section,
          includeNonStandard,
          depositRankMetric,
          detailsProducts,
          mortgageRateMetric,
        );
        return row ? { section, row } : null;
      })
      .filter((entry): entry is { section: (typeof interests)[number]; row: NonNullable<ReturnType<typeof bestRow>> } => entry !== null);
  }, [core, interests, profileFilters, detailsProducts, includeNonStandard, depositRankMetric, mortgageRateMetric, suitabilityRevision, publicCatalogue, scenario]);

  const openSaved = useCallback(() => router.navigate('/(tabs)/watchlist'), []);

  return (
    <NavigationHub title="Today" description="Your saved rates, the best rates for your profile, and the RBA." surface="home.hub" route="/" actions={actions}>
      <LedgerAction label="Find rates" icon="search" onPress={findRates} />

      <LedgerSection
        title="Rates you’re watching"
        action={saved.length > SAVED_PREVIEW ? <LedgerAction label="See all" variant="quiet" onPress={openSaved} /> : undefined}
      >
        {saved.length ? (
          saved.slice(0, SAVED_PREVIEW).map((item) => (
            <ProductCard
              key={`${item.row.product_key}:${item.row.rate_index ?? 'none'}`}
              row={item.row}
              section={item.section}
              onPress={() => openProduct(item.row.product_key, item.row.rate_index, item.row.public_programme_id)}
            />
          ))
        ) : (
          <EmptyState icon="star" title={SAVED_EMPTY_COPY[savedEmpty].title} subtitle={SAVED_EMPTY_COPY[savedEmpty].subtitle} />
        )}
      </LedgerSection>

      {bestByType.length ? (
        <LedgerSection title="Published rates for your profile">
          <LedgerText tone="mutedInk">Resolved products matched to your profile, ordered by your selected rate metric. Comparison rates remain separate from payable interest.</LedgerText>
          {bestByType.map(({ section, row }) => (
            <ProductCard
              key={`best:${section}`}
              row={row}
              section={section}
              onPress={() => openProduct(row.product_key, row.rate_index, row.public_programme_id)}
            />
          ))}
        </LedgerSection>
      ) : null}

      <RbaCountdownCard />
      {interests.map(section => <PublicPricingCoverage key={section} section={section} rows={core?.sections[section]?.rates ?? []} scenario={scenario} compact />)}

      <LedgerAction label="Set up your profile" variant="quiet" onPress={() => router.push('/profile')} />
    </NavigationHub>
  );
}
