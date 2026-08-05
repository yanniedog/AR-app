import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Alert, Linking, Pressable, View } from 'react-native';

import { EmptyState } from '../src/components/feedback';
import { SectionTitle } from '../src/components/product/ProductDetailParts';
import { ScreenScrollView } from '../src/components/Screen';
import { TOUCH_TARGET_MIN } from '../src/components/TouchTarget';
import { AppText, Button, Card, Divider, Row } from '../src/components/ui';
import {
  buildNegotiationBrief,
  buildRateReceipt,
  type ReceiptFact,
} from '../src/data/rateReceipt';
import { findByKey } from '../src/data/selectors';
import { useStore } from '../src/data/store';
import { useUserRateScenario } from '../src/hooks/useUserRateScenario';
import { useTheme } from '../src/theme/ThemeProvider';

function Facts({ items, empty }: { items: ReceiptFact[]; empty?: string }) {
  if (!items.length) {
    return empty ? <AppText variant="small" color="textMuted">{empty}</AppText> : null;
  }
  return (
    <>
      {items.map((fact, index) => (
        <View key={`${fact.label}-${index}`}>
          {index > 0 ? <Divider style={{ marginVertical: 10 }} /> : null}
          <Row style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <AppText variant="small" color="textMuted" style={{ flex: 1 }}>
              {fact.label}
            </AppText>
            <AppText variant="small" weight="600" style={{ flex: 1.4, textAlign: 'right' }}>
              {fact.value}
            </AppText>
          </Row>
        </View>
      ))}
    </>
  );
}

function money(value: number): string {
  return value.toLocaleString('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  });
}

export default function RateReceiptScreen() {
  const theme = useTheme();
  const { key, ri } = useLocalSearchParams<{ key?: string; ri?: string }>();
  const productKey = key ?? '';
  const requestedRateIndex = ri == null || ri === '' ? null : Number(ri);
  const validRateIndex = requestedRateIndex == null || Number.isInteger(requestedRateIndex);
  const core = useStore((state) => state.core);
  const detail = useStore((state) => state.details?.products[productKey] ?? null);
  const ensureDetails = useStore((state) => state.ensureDetails);
  const { scenario, storageStatus } = useUserRateScenario();
  const scenarioLoaded = storageStatus === 'ready';

  useEffect(() => {
    void ensureDetails({ forProductView: true });
  }, [ensureDetails]);

  const found = core ? findByKey(core.sections, productKey) : null;
  const row = found && validRateIndex
    ? requestedRateIndex == null
      ? found.row
      : found.siblings.find((candidate) => candidate.rate_index === requestedRateIndex) ?? null
    : null;
  const receipt = useMemo(
    () => row && found && core
      ? buildRateReceipt({ row, section: found.section, evidenceDate: core.run_date, detail })
      : null,
    [core, detail, found, row],
  );
  const brief = useMemo(
    () => receipt && found
      ? buildNegotiationBrief({
          receipt,
          scenario,
          sectionRows: core?.sections[found.section].rates ?? [],
        })
      : null,
    [core, found, receipt, scenario],
  );

  if (!core) return null;
  if (!found || !row || !receipt || !brief) {
    return (
      <>
        <Stack.Screen options={{ title: 'Rate receipt' }} />
        <EmptyState
          icon="receipt-outline"
          title="Exact rate no longer available"
          subtitle="The selected product tier is not present in this dataset. Return to the product and choose a current rate."
          fill
        />
      </>
    );
  }

  const hasScenario = brief.scenario.length > 0;

  return (
    <>
      <Stack.Screen options={{ title: 'Rate receipt' }} />
      <ScreenScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Card
          style={{
            marginBottom: 16,
            borderLeftWidth: 3,
            borderLeftColor: theme.colors.primary,
          }}
        >
          <Row gap={8} style={{ alignItems: 'flex-start' }}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText variant="small" weight="700">Generated privately on this device</AppText>
              <AppText variant="tiny" color="textMuted" style={{ marginTop: 3, lineHeight: 16 }}>
                Your saved financial scenario is read from encrypted local storage. This receipt and brief are not saved to general preferences, copied, shared or sent by Australian Rates.
              </AppText>
            </View>
          </Row>
        </Card>

        <Card style={{ marginBottom: 16, alignItems: 'center' }}>
          <AppText variant="small" color="textMuted">{receipt.provider}</AppText>
          <AppText variant="h3" style={{ marginTop: 2, textAlign: 'center' }}>{receipt.productName}</AppText>
          <AppText variant="h1" weight="800" style={{ marginTop: 10, color: theme.colors.primary }}>
            {receipt.advertisedRate}
          </AppText>
          <AppText variant="tiny" color="textMuted" style={{ marginTop: 4 }}>
            Exact rate row {receipt.rateIndex ?? 'default'} · observed {receipt.evidenceDate}
          </AppText>
          {receipt.comparisonRate ? (
            <AppText variant="small" color="textMuted" style={{ marginTop: 6 }}>
              {receipt.comparisonRate} comparison rate
            </AppText>
          ) : null}
          {receipt.ongoingRate ? (
            <AppText variant="small" color="textMuted">
              {receipt.ongoingRate} published ongoing rate
            </AppText>
          ) : null}
        </Card>

        <SectionTitle text="Exact published tier" icon="layers-outline" />
        <Card style={{ marginBottom: 16 }}><Facts items={receipt.tier} /></Card>

        <SectionTitle text="Conditions recorded" icon="checkmark-done-outline" />
        <Card style={{ marginBottom: 16 }}>
          <Facts
            items={receipt.conditions}
            empty="No detailed eligibility or constraint text was published in this dataset. Confirm directly with the lender."
          />
        </Card>

        {receipt.fees.length ? (
          <>
            <SectionTitle text="Fees recorded" icon="cash-outline" />
            <Card style={{ marginBottom: 16 }}><Facts items={receipt.fees} /></Card>
          </>
        ) : null}

        <SectionTitle text="Published source links" icon="link-outline" />
        <Card style={{ marginBottom: 16 }}>
          {receipt.officialSources.length ? receipt.officialSources.map((source, index) => (
            <View key={source.url}>
              {index > 0 ? <Divider /> : null}
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={`${source.label} on ${source.hostname}, opens external website`}
                onPress={() => Alert.alert(
                  'Open published source?',
                  `${source.hostname}\n\nConfirm this domain belongs to the lender before relying on it.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open', onPress: () => void Linking.openURL(source.url) },
                  ],
                )}
                style={({ pressed }) => ({
                  minHeight: TOUCH_TARGET_MIN,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons name="open-outline" size={17} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <AppText variant="small" weight="700" style={{ color: theme.colors.primary }}>
                    {source.label}
                  </AppText>
                  <AppText variant="tiny" color="textMuted">{source.hostname}</AppText>
                </View>
              </Pressable>
            </View>
          )) : (
            <AppText variant="small" color="textMuted">
              No valid HTTPS source link was published for this product.
            </AppText>
          )}
          <AppText variant="tiny" color="textFaint" style={{ marginTop: 8, lineHeight: 16 }}>
            Opening a link leaves the app. Confirm the displayed domain belongs to the lender; provider-to-domain identity is not cryptographically bound yet.
          </AppText>
        </Card>

        <SectionTitle text="Conversation brief" icon="chatbubbles-outline" />
        <Card style={{ marginBottom: 16 }}>
          <AppText variant="h3">{brief.title}</AppText>
          <AppText variant="small" color="textMuted" style={{ marginTop: 6, lineHeight: 20 }}>
            {brief.disclaimer}
          </AppText>
        </Card>

        <SectionTitle text="Your entered scenario" icon="person-outline" />
        <Card style={{ marginBottom: 16 }}>
          {!scenarioLoaded ? (
            <AppText variant="small" color="textMuted">Loading encrypted scenario…</AppText>
          ) : hasScenario ? (
            <Facts items={brief.scenario} />
          ) : (
            <>
              <AppText variant="small" color="textMuted" style={{ marginBottom: 12, lineHeight: 20 }}>
                Add your current rate and balance in Switch & save to make this brief specific to your scenario.
              </AppText>
              <Button title="Add scenario" variant="secondary" onPress={() => router.push('/calculator')} />
            </>
          )}
        </Card>

        <SectionTitle text="Selected evidence" icon="receipt-outline" />
        <Card style={{ marginBottom: 16 }}><Facts items={brief.selectedProduct} /></Card>

        {brief.illustration ? (
          <>
            <SectionTitle text="Illustrative difference" icon="calculator-outline" />
            <Card style={{ marginBottom: 16 }}>
              <AppText variant="h2" style={{ color: theme.colors.success }}>
                {money(brief.illustration.periodDifference)} {brief.illustration.periodLabel}
              </AppText>
              {brief.illustration.monthlyDifference != null ? (
                <AppText variant="body" weight="700" style={{ marginTop: 2 }}>
                  about {money(brief.illustration.monthlyDifference)} per month
                </AppText>
              ) : null}
              <AppText variant="small" color="textMuted" style={{ marginTop: 8, lineHeight: 20 }}>
                {brief.illustration.currentRate} entered current rate vs {brief.illustration.selectedRate} observed selected rate on {brief.evidenceDate}. {brief.illustration.assumption}
              </AppText>
            </Card>
          </>
        ) : null}

        <SectionTitle text="Comparable observed rates" icon="git-compare-outline" />
        <Card style={{ marginBottom: 16 }}>
          <AppText variant="tiny" color="textFaint" style={{ marginBottom: 10, lineHeight: 16 }}>
            {brief.cohortSummary}{brief.typicalAdvertisedRate ? ` · cohort median ${brief.typicalAdvertisedRate}` : ''}. Not eligibility-matched.
          </AppText>
          {brief.comparables.length ? brief.comparables.map((comparable, index) => (
            <View key={`${comparable.productKey}#${comparable.rateIndex ?? 'default'}`}>
              {index > 0 ? <Divider style={{ marginVertical: 10 }} /> : null}
              <Row style={{ alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <AppText variant="small" weight="700">{comparable.provider}</AppText>
                  <AppText variant="tiny" color="textMuted">{comparable.productName}</AppText>
                  {comparable.condition ? (
                    <AppText variant="tiny" color="textFaint" style={{ marginTop: 3 }}>
                      Conditions apply
                    </AppText>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <AppText variant="body" weight="800">{comparable.advertisedRate}</AppText>
                  {comparable.comparisonRate ? (
                    <AppText variant="tiny" color="textFaint">{comparable.comparisonRate} cmp</AppText>
                  ) : comparable.ongoingRate ? (
                    <AppText variant="tiny" color="textFaint">{comparable.ongoingRate} ongoing</AppText>
                  ) : null}
                </View>
              </Row>
            </View>
          )) : (
            <AppText variant="small" color="textMuted">No Standard comparable rows were available.</AppText>
          )}
        </Card>

        <SectionTitle text="Questions to ask" icon="help-circle-outline" />
        <Card style={{ marginBottom: 16 }}>
          {brief.prompts.map((prompt, index) => (
            <Row key={prompt} style={{ alignItems: 'flex-start', marginBottom: index === brief.prompts.length - 1 ? 0 : 10 }}>
              <AppText variant="small" weight="700" style={{ color: theme.colors.primary }}>{index + 1}.</AppText>
              <AppText variant="small" style={{ flex: 1, lineHeight: 20 }}>{prompt}</AppText>
            </Row>
          ))}
        </Card>

        <SectionTitle text="Limitations" icon="alert-circle-outline" />
        <Card>
          {brief.limitations.map((limitation) => (
            <Row key={limitation} style={{ alignItems: 'flex-start', marginBottom: 8 }}>
              <AppText variant="small" color="textMuted">•</AppText>
              <AppText variant="small" color="textMuted" style={{ flex: 1, lineHeight: 20 }}>
                {limitation}
              </AppText>
            </Row>
          ))}
        </Card>
      </ScreenScrollView>
    </>
  );
}
