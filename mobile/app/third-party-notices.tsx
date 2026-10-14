import { uiLabel } from "../src/lib/uiCopy";
import React from 'react';
import { View } from 'react-native';

import { RateMark } from '../src/components/RateMark';
import { ScreenScrollView } from '../src/components/Screen';
import { LedgerSection, LedgerText } from '../src/components/ledger';
import { DocumentText } from '../src/components/DocumentText';
import { uiIdentifier, uiJoin, uiNoticeMetadata } from '../src/lib/uiCopy';
import { THIRD_PARTY_NOTICES } from '../src/content/thirdPartyNotices';

function SourceReference({ url }: { url: string }) {
  return (
    <View style={{ gap: 2 }}>
      <LedgerText variant="caption" tone="mutedInk">{uiLabel("Source")}</LedgerText>
      <LedgerText variant="caption" selectable>{uiIdentifier(url)}</LedgerText>
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
          <LedgerText variant="title">{uiLabel("Third-party notices")}</LedgerText>
        </View>
      </View>

      {THIRD_PARTY_NOTICES.map((notice, index) => (
        <LedgerSection key={notice.name} title={uiNoticeMetadata(index, 'name')}>
          <LedgerText variant="caption" tone="mutedInk">{uiNoticeMetadata(index, 'licence')}</LedgerText>
          <LedgerText variant="caption" tone="mutedInk" selectable>
            {uiJoin('Revision', ' ', uiNoticeMetadata(index, 'revision'))}
          </LedgerText>
          <SourceReference url={notice.sourceUrl} />
          <View style={{ gap: 6, paddingTop: 8 }}>
            <LedgerText variant="label">{uiLabel("Licence notice")}</LedgerText>
            <DocumentText document="licence" index={index} />
          </View>
        </LedgerSection>
      ))}


    </ScreenScrollView>
  );
}
