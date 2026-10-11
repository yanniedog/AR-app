import React, { useMemo } from 'react';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';

/** The fixed shell has already consumed the top inset; preserve the other edges. */
export function NavigatorSafeArea({ topInsetConsumed, children }: {
  topInsetConsumed: boolean;
  children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const remainingInsets = useMemo(
    () => topInsetConsumed ? { ...insets, top: 0 } : insets,
    [insets, topInsetConsumed],
  );
  return <SafeAreaInsetsContext.Provider value={remainingInsets}>{children}</SafeAreaInsetsContext.Provider>;
}
