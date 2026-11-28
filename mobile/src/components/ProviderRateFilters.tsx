import React, { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import type { RateRow } from '../types';
import { humanizeEnum } from '../data/format';
import type { ProfileFilters } from '../data/profile';
import { uiJoin, type UiCopy } from '../lib/uiCopy';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button, Chip, Row } from './ui';

type Dimension = 'loanPurposes' | 'repaymentTypes' | 'rateTypes';
export function ProviderRateFilters({ rows, profile, onChange }: {
  rows: RateRow[]; profile: ProfileFilters; onChange: (profile: ProfileFilters) => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState<Dimension | null>(null);
  const dimensions: { key: Dimension; label: UiCopy; values: (readonly [string, UiCopy])[] }[] = [
    { key: 'loanPurposes', label: 'Purpose', values: [...new Set(rows.map(row => row.loan_purpose ?? row.security_purpose).filter((v): v is string => !!v))].map(value => [value, humanizeEnum(value)] as const) },
    { key: 'repaymentTypes', label: 'Repayment', values: [...new Set(rows.map(row => row.ribbon_repayment_type ?? row.repayment_type).filter((v): v is string => !!v))].map(value => [value, humanizeEnum(value)] as const) },
    { key: 'rateTypes', label: 'Rate type', values: [...new Set(rows.map(row => row.rate_type).filter((v): v is string => !!v))].map(value => [value, humanizeEnum(value)] as const) },
  ];
  const dimension = dimensions.find(item => item.key === editing);
  const choose = (key: Dimension, value: string | null) => { onChange({ ...profile, [key]: value ? [value] : [] }); setEditing(null); };
  return <>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
      <Row gap={6} style={{ paddingBottom: 6 }}>
        {dimensions.map(({ key, label, values }) => values.length ? <Chip key={key}
          label={uiJoin(label, ' \u00b7 ', profile[key].length ? values.find(([value]) => profile[key].includes(value))?.[1] ?? 'Selected' : 'All')}
          selected={profile[key].length > 0} onPress={() => setEditing(key)} /> : null)}
        <Chip label="Offset" selected={profile.accountFeatures.includes('OFFSET')}
          onPress={() => onChange({ ...profile, accountFeatures: profile.accountFeatures.includes('OFFSET')
            ? profile.accountFeatures.filter(value => value !== 'OFFSET') : [...profile.accountFeatures, 'OFFSET'] })} />
      </Row>
    </ScrollView>
    <Modal visible={!!dimension} transparent animationType="fade" onRequestClose={() => setEditing(null)}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#0008' }}>
        <View style={{ maxHeight: '75%', padding: 16, borderRadius: 16, backgroundColor: theme.colors.surface }}>
          {dimension ? <>
            <AppText variant="h3">{dimension.label}</AppText>
            <ScrollView contentContainerStyle={{ gap: 8, paddingVertical: 12 }}>
              <Chip label="All" selected={profile[dimension.key].length === 0} onPress={() => choose(dimension.key, null)} />
              {[...dimension.values].sort(([a], [b]) => a.localeCompare(b, 'en-AU', { numeric: true })).map(([value, label]) =>
                <Chip key={value} label={label} selected={profile[dimension.key].includes(value)} onPress={() => choose(dimension.key, value)} />)}
            </ScrollView>
          </> : null}
          <Button title="Close" variant="secondary" onPress={() => setEditing(null)} />
        </View>
      </View>
    </Modal>
  </>;
}
