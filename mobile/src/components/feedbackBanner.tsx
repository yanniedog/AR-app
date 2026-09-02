import React, { useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import type { PayloadProgressSnapshot } from '../data/downloadProgress';
import { useStore } from '../data/store';
import { useTheme } from '../theme/ThemeProvider';
import { resolveOfflineBanner } from './bannerState';
import { PayloadProgressBar } from './feedbackProgress';
import { AppText, Row } from './ui';
import { LedgerIcon, type LedgerIconName } from './icons/LedgerIcon';

const BANNER_FADE_MS = 320;
const SUCCESS_HOLD_MS = 900;

type BannerSurface = 'offline' | 'connecting' | 'syncing' | 'success' | 'pending';

function resolveBannerSurface(
  source: string,
  offline: boolean,
  refreshing: boolean,
  payloadProgress: PayloadProgressSnapshot | null,
  showSuccess: boolean,
  pendingIngestRunDate: string | null,
  showingRunDate: string | null,
): { surface: BannerSurface; message: string; showProgress: boolean } | null {
  if (showSuccess && !pendingIngestRunDate) {
    return { surface: 'success', message: 'Live rates updated', showProgress: false };
  }

  if (refreshing && payloadProgress) {
    if (source === 'sample') {
      return {
        surface: 'connecting',
        message: 'Showing bundled sample data — connecting for the latest…',
        showProgress: true,
      };
    }
    return {
      surface: 'syncing',
      message: 'Syncing latest rates…',
      showProgress: true,
    };
  }

  const banner = resolveOfflineBanner(
    source,
    offline,
    refreshing,
    payloadProgress,
    pendingIngestRunDate,
    showingRunDate,
  );
  if (banner.mode === 'hidden') return null;

  if (banner.mode === 'connecting') {
    return {
      surface: 'connecting',
      message: banner.message,
      showProgress: banner.showLiveProgress,
    };
  }

  if (banner.mode === 'pending-ingest') {
    return {
      surface: 'pending',
      message: banner.message,
      showProgress: false,
    };
  }

  return {
    surface: 'offline',
    message: banner.message,
    showProgress: false,
  };
}

export function OfflineBanner({
  source,
  offline,
  containerStyle,
}: {
  source: string;
  offline: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const payloadProgress = useStore((s) => s.payloadProgress);
  const refreshing = useStore((s) => s.refreshing);
  const pendingIngestRunDate = useStore((s) => s.pendingIngestRunDate);
  const showingRunDate = useStore((s) => s.core?.run_date ?? null);
  const prevRefreshing = useRef(refreshing);
  const [showSuccess, setShowSuccess] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const wasRefreshing = prevRefreshing.current;
    prevRefreshing.current = refreshing;

    if (
      wasRefreshing &&
      !refreshing &&
      source === 'remote' &&
      !offline &&
      !pendingIngestRunDate
    ) {
      setShowSuccess(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setShowSuccess(false), SUCCESS_HOLD_MS + BANNER_FADE_MS);
    }
  }, [refreshing, source, offline, pendingIngestRunDate]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const bannerView = resolveBannerSurface(
    source,
    offline,
    refreshing,
    payloadProgress,
    showSuccess,
    pendingIngestRunDate,
    showingRunDate,
  );
  if (!bannerView) return null;

  const { surface, message, showProgress } = bannerView;
  const sampleTone = surface === 'connecting' || surface === 'success';
  const pendingTone = surface === 'pending';
  const iconName: LedgerIconName =
    surface === 'success'
      ? 'success'
      : surface === 'syncing'
        ? 'refresh'
        : pendingTone
          ? 'refresh'
          : sampleTone
            ? 'info'
            : 'offline';
  const iconColor =
    surface === 'success'
      ? theme.colors.success
      : pendingTone || sampleTone
        ? theme.colors.primary
        : theme.colors.warning;

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(BANNER_FADE_MS)}
      style={[{ marginBottom: 12 }, containerStyle]}
    >
      <Row
        gap={8}
        style={{
          backgroundColor: theme.ledger.raised,
          paddingHorizontal: 12,
          paddingVertical: 10,
          borderLeftWidth: 3,
          borderLeftColor: iconColor,
          borderBottomWidth: 1,
          borderBottomColor: theme.ledger.rule,
          alignItems: showProgress && payloadProgress ? 'flex-start' : 'center',
        }}
      >
        <LedgerIcon
          name={iconName}
          size={16}
          color={iconColor}
          style={showProgress && payloadProgress ? { marginTop: 2 } : undefined}
        />
        {showProgress && payloadProgress ? (
          <PayloadProgressBar progress={payloadProgress} caption={message} />
        ) : (
          <AppText variant="small" color="textMuted" style={{ flex: 1 }}>
            {message}
          </AppText>
        )}
      </Row>
    </Animated.View>
  );
}

/** Global data-health strip — same logic as {@link OfflineBanner}. */
export const DataHealthBanner = OfflineBanner;
