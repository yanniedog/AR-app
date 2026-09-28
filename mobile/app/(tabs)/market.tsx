import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { DestinationRow, NavigationHub } from '../../src/components/NavigationHub';
import { LedgerSection } from '../../src/components/ledger';

const openResearch = () => router.push('/research');
const actions = { 'market.open': () => undefined, 'market.outlook.open': openResearch };

export default function Market() {
  return (
    <NavigationHub title="The rate market" description="See where rates are moving and why." surface="market.hub" route="/market" actions={actions}>
      <View>
        <DestinationRow title="Bank rates over time" description="Compare bank history, with rates shown first." icon="bank" onPress={() => router.push('/bank-rates')} />
        <DestinationRow title="Recent rate changes" description="Which products and banks have moved." icon="changes" onPress={() => router.push('/passthrough')} />
        <DestinationRow title="Bank response to the RBA" description="How banks responded to cash-rate decisions." icon="compare" onPress={() => router.push('/rba-response')} />
      </View>
      <LedgerSection title="The wider picture">
        <DestinationRow title="RBA rates and outlook" description="The cash rate, meetings and forecasts." icon="calendar" onPress={() => router.push('/rba')} />
        <DestinationRow title="Market research" description="Longer-term trends and economic indicators." icon="pulse" onPress={openResearch} />
      </LedgerSection>
    </NavigationHub>
  );
}
