import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { resolveInterestSection } from '../data/interests';
import { useStore } from '../data/store';
import {
  APP_DESTINATION_GROUPS,
  destinationHref,
  destinationIsActive,
  type AppDestination,
} from '../lib/appDestinations';
import { useTheme } from '../theme/ThemeProvider';
import { TouchTarget } from './TouchTarget';
import { AppText, Divider, Row } from './ui';

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
      accessibilityLabel="Open app menu"
      accessibilityState={{ expanded: menu.open }}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons name="menu" size={25} color={theme.colors.text} />
    </TouchTarget>
  );
}

export function AppNavigationMenu() {
  const theme = useTheme();
  const menu = useNavigationMenu();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const section = useStore((state) =>
    resolveInterestSection(state.prefs.interests, state.activeSection));
  const interests = useStore((state) => state.prefs.interests);
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
      animationType="fade"
      onRequestClose={menu.hide}
      statusBarTranslucent
    >
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <View
          accessibilityViewIsModal
          style={{
            width: drawerWidth,
            maxWidth: '92%',
            backgroundColor: theme.colors.surface,
            paddingTop: Math.max(insets.top, 12),
            paddingBottom: Math.max(insets.bottom, 12),
            borderRightWidth: 1,
            borderRightColor: theme.colors.border,
          }}
        >
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16 }}>
            <AppText variant="h2">Menu</AppText>
            <TouchTarget
              square
              onPress={menu.hide}
              accessibilityRole="button"
              accessibilityLabel="Close app menu"
            >
              <Ionicons name="close" size={24} color={theme.colors.text} />
            </TouchTarget>
          </Row>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 20 }}>
            {APP_DESTINATION_GROUPS.map((group, groupIndex) => (
              <View key={group.id}>
                {groupIndex > 0 ? <Divider style={{ marginVertical: 10 }} /> : null}
                <AppText
                  variant="tiny"
                  color="textFaint"
                  weight="700"
                  style={{ paddingHorizontal: 12, paddingVertical: 6, letterSpacing: 0.5 }}
                >
                  {group.label.toUpperCase()}
                </AppText>
                {group.destinations.filter((destination) => {
                  if (destination.id === 'home-loans') return interests.includes('Mortgage');
                  if (destination.id === 'savings') return interests.includes('Savings');
                  if (destination.id === 'term-deposits') return interests.includes('TD');
                  return true;
                }).map((destination) => {
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
                        borderRadius: theme.radius.md,
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        backgroundColor: selected ? theme.colors.primaryMuted : 'transparent',
                        opacity: pressed ? 0.65 : 1,
                      })}
                    >
                      <Ionicons
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
