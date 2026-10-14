import React from 'react';
import { View } from 'react-native';
import { AppText, Button } from '../ui';
import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';
import { useAuditExternalLinks } from '../../hooks/useAuditExternalLinks';
import { uiLabel, uiIdentifier, uiJoin } from '../../lib/uiCopy';
import type { EvidenceReference } from '../../lib/productTermsEngine/types';
export function DepositSource({ source }: { source: EvidenceReference }) {
  const { requestExternalUrl } = useTrustedExternalUrl();
  useAuditExternalLinks([{ url: source.sourceUrl, purpose: 'lender_source', label: 'Source' }]);
  return <View style={{ gap: 4 }}>
    <AppText variant="small">{uiJoin('Source', ' ', uiIdentifier(source.id))}</AppText>
    <AppText variant="small" color="textMuted">{uiLabel("Source review required")}</AppText>
    <Button title="Open source" variant="secondary" onPress={() => requestExternalUrl({ url: source.sourceUrl, purpose: 'lender_source', label: 'Source' })} />
  </View>;
}
