import React from 'react';
import { View } from 'react-native';
import Ionicons from './icons/AppIcon';
import type { AuditCheck } from '../lib/performanceAudit';
import { auditOutcome, auditOutcomeCounts, type AuditOutcome, type UploadOutcome } from '../lib/auditPresentation';
import { uiCount, uiJoin, type UiLabel } from '../lib/uiCopy';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Row } from './ui';

const OUTCOMES: Record<AuditOutcome, { icon: keyof typeof Ionicons.glyphMap; label: UiLabel }> = {
  pass: { icon: 'checkmark-circle', label: 'Passed' }, warning: { icon: 'warning-outline', label: 'Warnings' },
  failure: { icon: 'close-circle', label: 'Failures' }, timing: { icon: 'time', label: 'Timing overruns' },
  skipped: { icon: 'close-circle-outline', label: 'Skipped' }, unavailable: { icon: 'help-circle-outline', label: 'Unavailable' },
  'untested-link': { icon: 'link-outline', label: 'Untested links' },
};
export function AuditOutcomeSymbols({ checks }: { checks: readonly AuditCheck[] }) {
  const theme = useTheme(), counts = auditOutcomeCounts(checks);
  return <Row gap={12} style={{ flexWrap: 'wrap' }}>{(Object.keys(OUTCOMES) as AuditOutcome[]).map(key => {
    const item = OUTCOMES[key], label = uiJoin(item.label, ' · ', uiCount(counts[key]));
    return <View key={key} accessible accessibilityLabel={label} style={{ maxWidth: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={item.icon} size={22} accessible={false} color={key === 'pass' ? theme.colors.success : key === 'failure' ? theme.colors.danger : key === 'timing' || key === 'warning' ? theme.colors.warning : theme.colors.textMuted} />
      <AppText variant="small" style={{ flexShrink: 1, minWidth: 0 }}>{label}</AppText>
    </View>;
  })}</Row>;
}
export function AuditCheckSymbol({ check }: { check: AuditCheck }) {
  const theme = useTheme(), state = auditOutcome(check), item = OUTCOMES[state];
  return <View accessible accessibilityLabel={item.label} style={{ maxWidth: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <Ionicons name={item.icon} size={20} accessible={false} color={state === 'pass' ? theme.colors.success : state === 'failure' ? theme.colors.danger : state === 'timing' || state === 'warning' ? theme.colors.warning : theme.colors.textMuted} />
    <AppText variant="small" style={{ flexShrink: 1, minWidth: 0 }}>{item.label}</AppText>
  </View>;
}

const DELIVERY: Record<UploadOutcome, { icon: keyof typeof Ionicons.glyphMap; label: UiLabel }> = {
  local: { icon: 'folder-outline', label: 'Local' }, pending: { icon: 'cloud-upload-outline', label: 'Pending' },
  verified: { icon: 'checkmark-circle', label: 'Verified upload' }, failed: { icon: 'close-circle', label: 'Upload failed' },
  uncertain: { icon: 'help-circle-outline', label: 'Upload uncertain' },
};
export function AuditDeliverySymbol({ outcome }: { outcome: UploadOutcome }) {
  const theme = useTheme(), item = DELIVERY[outcome];
  return <View accessible accessibilityLabel={item.label} style={{ maxWidth: '100%', minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <Ionicons name={item.icon} size={22} accessible={false} color={outcome === 'verified' ? theme.colors.success : outcome === 'failed' ? theme.colors.danger : outcome === 'uncertain' ? theme.colors.warning : theme.colors.textMuted} />
    <AppText variant="small" weight="700" style={{ flexShrink: 1, minWidth: 0 }}>{item.label}</AppText>
  </View>;
}
