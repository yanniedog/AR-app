import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { DisplayEvidence } from '../../data/displayEvidence';
import type { LedgerPalette } from '../../theme/colors';
import { useTheme } from '../../theme/ThemeProvider';
import { LedgerIcon, type LedgerIconName } from '../icons/LedgerIcon';
import { LedgerSheet } from './LedgerSheet';
import { LedgerText } from './LedgerText';
import { PressFeedback } from '../PressFeedback';
import { uiEvidenceFact, uiEvidenceStatus } from '../../lib/financialUiCopy';
import { uiDate, uiJoin, uiLabel, type UiCopy } from '../../lib/uiCopy';
import { FinancialFactRows } from '../product/FinancialFactRows';

const ICONS: Record<DisplayEvidence['kind'], LedgerIconName> = {
  current: 'success',
  partial: 'warning',
  saved: 'receipt',
  overdue: 'alert',
  sample: 'info',
  offline: 'offline',
  unavailable: 'alert',
  loading: 'refresh',
};

const TONES: Record<DisplayEvidence['tone'], keyof LedgerPalette> = {
  positive: 'success',
  caution: 'warning',
  neutral: 'mutedInk',
  danger: 'danger',
};

export function DataEvidenceLine({
  evidence,
  onPress,
  detailsTitle = 'Data',
}: {
  evidence: DisplayEvidence;
  onPress?: () => void;
  detailsTitle?: UiCopy;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const model = evidence.presentation;
  const tone = TONES[model.tone];
  const status = uiEvidenceStatus(model);
  const observation = model.facts.find(fact => fact.kind === 'observed');
  const observed = observation?.state === 'known' ? uiDate(observation.day) : uiLabel('Unknown');

  const openDetails = () => {
    if (onPress) onPress();
    else setOpen(true);
  };

  return (
    <>
      <PressFeedback
        accessibilityRole="button"
        accessibilityLabel={uiJoin('Data', ' · ', status, ' · ', 'Observed', ': ', observed)}
        onPress={openDetails}
        contentStyle={{ flexGrow: 1 }}
        style={{
          minHeight: 48,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 8,
        }}
      >
        <LedgerIcon name={ICONS[model.kind]} size={18} color={theme.ledger[tone]} />
        <View style={{ flex: 1 }}>
          <LedgerText variant="caption" tone={tone}>{status}</LedgerText>
          <LedgerText variant="caption" tone="mutedInk" numberOfLines={2}>
            {uiJoin('Observed', ': ', observed)}
          </LedgerText>
        </View>
        <LedgerIcon name="chevron-right" size={16} color={theme.ledger.mutedInk} />
      </PressFeedback>

      {!onPress ? (
        <LedgerSheet visible={open} title={detailsTitle} onClose={() => setOpen(false)}>
          <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
            <FinancialFactRows rows={model.facts.map(uiEvidenceFact)} />
          </ScrollView>
        </LedgerSheet>
      ) : null}
    </>
  );
}
