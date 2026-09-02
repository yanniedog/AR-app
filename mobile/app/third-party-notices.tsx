import React from 'react';
import { View } from 'react-native';

import { RateMark } from '../src/components/RateMark';
import { ScreenScrollView } from '../src/components/Screen';
import { LedgerSection, LedgerText } from '../src/components/ledger';
import { DESIGN_REFERENCES, THIRD_PARTY_NOTICES } from '../src/content/thirdPartyNotices';

function SourceReference({ url }: { url: string }) {
  return (
    <View style={{ gap: 2 }}>
      <LedgerText variant="caption" tone="mutedInk">Source (select to copy)</LedgerText>
      <LedgerText variant="caption" selectable>{url}</LedgerText>
    </View>
  );
}

export default function ThirdPartyNoticesScreen() {
  return (
    <ScreenScrollView
      showDataHealthBanner={false}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48, gap: 32 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <RateMark size={44} />
        <View style={{ flex: 1 }}>
          <LedgerText variant="title">Third-party notices</LedgerText>
          <LedgerText tone="mutedInk">Open-source work used by Rate Ledger.</LedgerText>
        </View>
      </View>

      {THIRD_PARTY_NOTICES.map((notice) => (
        <LedgerSection key={notice.name} title={notice.name} deck={notice.purpose}>
          <LedgerText variant="caption" tone="mutedInk">{notice.licence}</LedgerText>
          <LedgerText variant="caption" tone="mutedInk" selectable>
            Revision {notice.pinnedRevision}
          </LedgerText>
          <SourceReference url={notice.sourceUrl} />
          <View style={{ gap: 6, paddingTop: 8 }}>
            <LedgerText variant="label">Licence notice</LedgerText>
            <LedgerText variant="caption" tone="mutedInk" selectable>
              {notice.noticeText}
            </LedgerText>
          </View>
        </LedgerSection>
      ))}

      <LedgerSection
        title="Design references"
        deck="These projects informed testing and craft decisions but are not redistributed in the app."
      >
        {DESIGN_REFERENCES.map((reference) => (
          <View key={reference.name} style={{ gap: 4 }}>
            <LedgerText variant="label">{reference.name}</LedgerText>
            <LedgerText variant="caption" tone="mutedInk">{reference.note}</LedgerText>
            <LedgerText variant="caption" tone="mutedInk">{reference.licence}</LedgerText>
            <SourceReference url={reference.sourceUrl} />
          </View>
        ))}
      </LedgerSection>
    </ScreenScrollView>
  );
}
