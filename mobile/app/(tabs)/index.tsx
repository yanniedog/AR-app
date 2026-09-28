import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

import { DestinationRow, NavigationHub } from '../../src/components/NavigationHub';
import { LedgerAction, LedgerSection } from '../../src/components/ledger';

const findRates = () => router.navigate('/(tabs)/browse');
const actions = { 'home.open': () => undefined, 'redirect.root.verify': () => undefined, 'home.rates.open': findRates };

export default function Home() {
  return (
    <NavigationHub title="Start here" description="Find a rate. Keep track. Plan ahead." surface="home.hub" route="/" actions={actions}>
      <LedgerSection title="Find a rate" deck="Home loans, savings accounts and term deposits." ruled={false}>
        <LedgerAction label="Find rates" onPress={findRates} />
      </LedgerSection>
      <View>
        <DestinationRow title="Saved products" description="Your shortlist and rate alerts." icon="save" onPress={() => router.navigate('/(tabs)/watchlist')} />
        <DestinationRow title="Market" description="Bank rates, recent changes and the RBA." icon="changes" onPress={() => router.navigate('/(tabs)/market')} />
        <DestinationRow title="Tools" description="Check your rate and project your balance." icon="calculator" onPress={() => router.navigate('/(tabs)/tools')} />
      </View>
      <LedgerAction label="Set up your profile" variant="quiet" onPress={() => router.push('/profile')} />
    </NavigationHub>
  );
}
