import React from 'react';
import { View } from 'react-native';
import { AppText, Button } from '../ui';
import { useTrustedExternalUrl } from '../ExternalLinkConfirmation';
import type { EvidenceReference } from '../../lib/productTermsEngine/types';
export function DepositSource({ source }: { source: EvidenceReference }) {
  const { requestExternalUrl } = useTrustedExternalUrl();
  return <View style={{ gap: 4 }}>
    <AppText variant="small">{source.locator}</AppText><AppText variant="small">{source.quote}</AppText>
    <Button title={`Open source: ${source.locator}`} variant="secondary" onPress={() => requestExternalUrl({ url: source.sourceUrl, purpose: 'lender_source', label: source.locator })} />
  </View>;
}
