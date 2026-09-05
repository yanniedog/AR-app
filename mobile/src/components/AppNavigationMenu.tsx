import { router, useGlobalSearchParams, usePathname } from 'expo-router';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveInterestSection } from '../data/interests';
import { useStore } from '../data/store';
import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  APP_DESTINATION_GROUPS,
  destinationSectionFromParam,
  destinationHref,
  destinationIsActive,
  type AppDestination,
} from '../lib/appDestinations';
import { useTheme } from '../theme/ThemeProvider';
import { TouchTarget } from './TouchTarget';
import { AppText, Divider, Row } from './ui';
import { LedgerIcon } from './icons/LedgerIcon';

interface NavigationMenuContextValue {
  open: boolean;
  show: () => void;
  hide: () => void;
}

const NavigationMenuContext = createContext<NavigationMenuContextValue | null>(null);

export function NavigationMenuProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({
    open,
    show: () => setOpen(true),
    hide: () => setOpen(false),
  }), [open]);
  return <NavigationMenuContext.Provider value={value}>{children}</NavigationMenuContext.Provider>;
}

function useNavigationMenu(): NavigationMenuContextValue {
  const value = useContext(NavigationMenuContext);
  if (!value) throw new Error('Navigation menu must be inside NavigationMenuProvider');
  return value;
}

export function NavigationMenuButton() {
  const theme = useTheme();
  const onboarded = useStore((state) => state.prefs.onboarded);
  const menu = useNavigationMenu();
  if (!onboarded) return null;
  return (
    <TouchTarget
      square
      onPress={menu.show}
      accessibilityRole="button"
      accessibilityLabel="Open account and app menu"
      accessibilityState={{ expanded: menu.open }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <LedgerIcon name="menu" size={25} color={theme.ledger.ink} />
    </TouchTarget>
  );
}

export function AppNavigationMenu() {
  const theme = useTheme();
  const menu = useNavigationMenu();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ section?: string | string[] }>();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const activeSection = useStore((state) => state.activeSection);
  const interests = useStore((state) => state.prefs.interests);
  const section = resolveInterestSection(
    interests,
    destinationSectionFromParam(params.section) ?? activeSection,
  );
  const drawerWidth = Math.min(360, Math.max(280, width * 0.88));

  const openDestination = useCallback((destination: AppDestination) => {
    const href = destinationHref(destination, section);
    menu.hide();
    requestAnimationFrame(() => router.navigate(href));
  }, [menu, section]);

  return (
    <Modal
      visible={menu.open}
      transparent
      animationType={reducedMotion === false ? 'fade' : 'none'}
      onRequestClose={menu.hide}
      statusBarTranslucent
    >
      <View style={{ flex: 1, flexDirection: 'row-reverse' }}>
        <View
          accessibilityViewIsModal
          style={{
            width: drawerWidth,
            maxWidth: '92%',
            backgroundColor: theme.colors.surface,
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 12),
            borderLeftWidth: 1,
            borderLeftColor: theme.colors.border,
          }}
        >
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16 }}>
            <AppText variant="h2">Account and app</AppText>
            <TouchTarget
              square
              onPress={menu.hide}
              accessibilityRole="button"
              accessibilityLabel="Close app menu"
            >
              <LedgerIcon name="close" size={24} color={theme.ledger.ink} />
            </TouchTarget>
          </Row>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}>
            {APP_DESTINATION_GROUPS.map((group, groupIndex) => (
              <View key={group.id}>
                {groupIndex > 0 ? <Divider style={{ marginVertical: 10 }} /> : null}
                {group.destinations.map((destination) => {
                  const selected = destinationIsActive(destination.id, pathname);
                  return (
                    <Pressable
                      key={destination.id}
                      onPress={() => openDestination(destination)}
                      accessibilityRole="button"
                      accessibilityLabel={destination.label}
                      accessibilityState={{ selected }}
                      style={({ pressed }) => ({
                        minHeight: 48,
                        borderRadius: theme.radius.sm,
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
                        borderLeftWidth: 3,
                        borderLeftColor: selected ? theme.ledger.wattle : 'transparent',
                        opacity: pressed ? 0.65 : 1,
                      })}
                    >
                      <LedgerIcon
                        name={destination.icon}
                        size={21}
                        color={selected ? theme.colors.primary : theme.colors.textMuted}
                      />
                      <AppText
                        variant="body"
                        weight={selected ? '700' : '500'}
                        color={selected ? 'primary' : 'text'}
                        style={{ flex: 1 }}
                      >
                        {destination.label}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
        <Pressable
          onPress={menu.hide}
          accessibilityRole="button"
          accessibilityLabel="Close app menu"
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.48)' }}
        />
      </View>
    </Modal>
  );
}
