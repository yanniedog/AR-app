import Ionicons from './icons/AppIcon';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated as RNAnimated } from 'react-native';
import { formatRunDate } from '../data/format';
import { useStore } from '../data/store';
import { logRetry } from '../lib/degradationLog';
import { useTheme } from '../theme/ThemeProvider';
import { resolveRefreshOutcomeSnackbar } from './bannerState';
import { TouchTarget } from './TouchTarget';
import { AppText, Row } from './ui';

const SNACKBAR_DISMISS_MS: Record<'success' | 'failure' | 'wifi-skip', number> = {
  success: 3500,
  failure: 7000,
  'wifi-skip': 5000,
};

// 48 dp actions; negative margins keep the bar's visual height unchanged.
const SNACKBAR_ACTION = { marginVertical: -12, marginRight: -10, paddingHorizontal: 4 } as const;

/** Bottom snackbar for refresh success, failure, or Wi-Fi-only skip. Mount once per tab layout. */
export function RefreshOutcomeSnackbar() {
  const theme = useTheme();
  const outcome = useStore((s) => s.refreshOutcome);
  const core = useStore((s) => s.core);
  const clearRefreshOutcome = useStore((s) => s.clearRefreshOutcome);
  const refresh = useStore((s) => s.refresh);
  const opacity = useRef(new RNAnimated.Value(0)).current;
  const translateY = useRef(new RNAnimated.Value(12)).current;

  const model = outcome ? resolveRefreshOutcomeSnackbar(outcome, formatRunDate(core?.run_date)) : null;

  useEffect(() => {
    if (!outcome) return;
    opacity.setValue(0);
    translateY.setValue(12);
    RNAnimated.parallel([
      RNAnimated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      RNAnimated.timing(translateY, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => clearRefreshOutcome(), SNACKBAR_DISMISS_MS[outcome]);
    return () => clearTimeout(timer);
  }, [outcome, clearRefreshOutcome, opacity, translateY]);

  if (!model) return null;

  const iconName =
    model.kind === 'success'
      ? 'checkmark-circle'
      : model.kind === 'failure'
        ? 'cloud-offline-outline'
        : 'wifi-outline';
  const iconColor =
    model.kind === 'success'
      ? theme.colors.success
      : model.kind === 'failure'
        ? theme.colors.warning
        : theme.colors.primary;

  const onAction = () => {
    clearRefreshOutcome();
    if (model.action === 'retry') {
      logRetry('refresh', 'start');
      void refresh({ manual: true }).then((changed) => {
        const refreshOutcome = useStore.getState().refreshOutcome;
        if (refreshOutcome === 'failure') {
          logRetry('refresh', 'failure', useStore.getState().error ?? 'refresh failed');
        } else {
          logRetry('refresh', 'success', changed ? 'data_changed' : 'up_to_date');
        }
      });
    }
    if (model.action === 'settings') router.push('/settings');
  };

  return (
    <RNAnimated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        // Root AppTabBar sits below the navigator; overlay only needs a small inset
        // inside the content pane (do not re-add the tab bar height).
        bottom: 8,
        opacity,
        transform: [{ translateY }],
        zIndex: 100,
      }}
    >
      <Row
        gap={10}
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.lg,
          borderWidth: 1,
          borderColor: theme.colors.border,
          paddingHorizontal: 14,
          paddingVertical: 12,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      >
        <Ionicons name={iconName} size={18} color={iconColor} />
        <AppText variant="small" style={{ flex: 1 }}>
          {model.message}
        </AppText>
        {model.actionLabel ? (
          <TouchTarget
            square
            onPress={onAction}
            hitSlop={0}
            accessibilityRole="button"
            accessibilityLabel={model.actionLabel}
            style={SNACKBAR_ACTION}
          >
            <AppText variant="small" weight="700" style={{ color: theme.colors.primary }}>
              {model.actionLabel}
            </AppText>
          </TouchTarget>
        ) : (
          <TouchTarget
            square
            onPress={() => clearRefreshOutcome()}
            hitSlop={0}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            style={SNACKBAR_ACTION}
          >
            <Ionicons name="close" size={18} color={theme.colors.textMuted} />
          </TouchTarget>
        )}
      </Row>
    </RNAnimated.View>
  );
}
