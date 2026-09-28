import { router } from 'expo-router';
import React, { useMemo } from 'react';
import { View } from 'react-native';

import { DestinationRow, NavigationHub } from '../../src/components/NavigationHub';
import { LedgerSection } from '../../src/components/ledger';
import { resolveInterestSection } from '../../src/data/interests';
import { useStore } from '../../src/data/store';

export default function Tools() {
  const interests = useStore(s => s.prefs.interests);
  const activeSection = useStore(s => s.activeSection);
  const section = resolveInterestSection(interests, activeSection);
  const actions = useMemo(() => ({
    'tools.open': () => undefined,
    'tools.calculator.open': () => router.push({ pathname: '/calculator', params: { section } }),
  }), [section]);
  return (
    <NavigationHub title="Your rate tools" description="Work out what a different rate could mean for you." surface="tools.hub" route="/tools" actions={actions}>
      <View>
        <DestinationRow title="Check my rate" description="Enter your current rate, balance and bank." icon="calculator" onPress={actions['tools.calculator.open']} />
        <DestinationRow title="Project my balance" description="Compare staying, switching and future rate changes." icon="changes" onPress={() => router.push({ pathname: '/projections', params: { section } })} />
        <DestinationRow title="Your profile" description="Choose product types and the features you need." icon="profile" onPress={() => router.push('/profile')} />
      </View>
      <LedgerSection title="App">
        <DestinationRow title="Settings" description="Appearance, alerts, privacy and app updates." icon="settings" onPress={() => router.push('/settings')} />
        <DestinationRow title="About and help" description="How the app works, terms and diagnostics." icon="about" onPress={() => router.push('/about')} />
      </LedgerSection>
    </NavigationHub>
  );
}
