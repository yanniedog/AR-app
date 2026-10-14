import { usePathname } from 'expo-router';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useStore } from '../data/store';
import { APP_DESTINATION_GROUPS, destinationHref, destinationIsActive, type AppDestination } from '../lib/appDestinations';
import { navigateToAppDestination } from '../lib/primaryNavigation';
import { useTheme } from '../theme/ThemeProvider';
import { SheetSurface } from './SheetSurface';
import { TouchTarget } from './TouchTarget';
import { AppText } from './ui';
import type { UiChild } from '../lib/uiCopy';
import { LedgerIcon } from './icons/LedgerIcon';

interface NavigationMenuContextValue { open: boolean; show: () => void; hide: () => void }
const NavigationMenuContext = createContext<NavigationMenuContextValue | null>(null);
export function NavigationMenuProvider({ children }: { children: UiChild }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, show: () => setOpen(true), hide: () => setOpen(false) }), [open]);
  return <NavigationMenuContext.Provider value={value}>{children}</NavigationMenuContext.Provider>;
}
function useNavigationMenu(): NavigationMenuContextValue {
  const value = useContext(NavigationMenuContext);
  if (!value) throw new Error('Navigation menu must be inside NavigationMenuProvider');
  return value;
}
export function NavigationMenuButton({ compact: _compact = true }: { compact?: boolean } = {}) {
  const theme = useTheme(), menu = useNavigationMenu();
  const hydrated = useStore(state => state.hydrated);
  if (!hydrated) return null;
  return <TouchTarget square onPress={menu.show} accessibilityRole="button"
    accessibilityLabel="Account" accessibilityState={{ expanded: menu.open }}>
    <LedgerIcon name="profile" size={22} color={theme.colors.text} />
  </TouchTarget>;
}
export function AppNavigationMenu() {
  const theme = useTheme(), menu = useNavigationMenu(), pathname = usePathname();
  const openDestination = useCallback((destination: AppDestination) => {
    menu.hide();
    requestAnimationFrame(() => navigateToAppDestination(destinationHref(destination), pathname));
  }, [menu, pathname]);
  return <SheetSurface visible={menu.open} title="Account" onClose={menu.hide}>
    <ScrollView contentContainerStyle={{ padding: 16, gap: 4 }}>
      {APP_DESTINATION_GROUPS.flatMap(group => group.destinations).map(destination => {
        const selected = destinationIsActive(destination.id, pathname);
        return <TouchTarget fill key={destination.id} onPress={() => openDestination(destination)}
          accessibilityRole="button" accessibilityLabel={destination.label} accessibilityState={{ selected }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 12,
            borderRadius: theme.radius.md, backgroundColor: selected ? theme.colors.primaryMuted : 'transparent' }}>
          <LedgerIcon name={destination.icon} size={22} color={selected ? theme.colors.primary : theme.colors.textMuted} />
          <AppText variant="body" weight={selected ? '700' : '500'} style={{ flex: 1 }}>{destination.label}</AppText>
          <View accessible={false}><LedgerIcon name="chevron-right" size={18} color={theme.colors.textMuted} /></View>
        </TouchTarget>;
      })}
    </ScrollView>
  </SheetSurface>;
}
