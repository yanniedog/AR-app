import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppText, Disclosure } from '../ui';
import { useStore } from '../../data/store';
import { scopedRateConditions, type ScopedRateConditions } from '../../data/rateConditions';
import type { RateRow, SectionKey } from '../../types';

export function RateConditionsDisclosure({ model }: { model: ScopedRateConditions }) {
  const [open, setOpen] = useState(false);
  return <Disclosure title="Rate conditions" summary={model.status === 'available' ? `${model.entries.length} published item${model.entries.length === 1 ? '' : 's'}` : 'Unavailable for this row'} open={open} onToggle={() => setOpen(!open)}>
    {open ? <View style={{ gap: 12 }}>
      <AppText variant="small" color="textMuted">{model.reason}</AppText>
      {model.entries.map(entry => <AppText key={entry.id} variant="small">{entry.text}</AppText>)}
    </View> : null}
  </Disclosure>;
}
export function SelectedRateConditions({ row, section }: { row: RateRow; section: SectionKey }) {
  const core = useStore(s => s.core), details = useStore(s => s.details), manifest = useStore(s => s.manifest), coreIntegrity = useStore(s => s.coreIntegrity);
  const model = useMemo(() => scopedRateConditions(row, section, { core, details, manifest, coreIntegrity }), [row, section, core, details, manifest, coreIntegrity]);
  return <RateConditionsDisclosure model={model} />;
}
