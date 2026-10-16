import { fontStyle } from '../theme/fonts';
import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Image, Text, View } from 'react-native';
import { SvgUri } from 'react-native-svg';

import {
  isSvgLogoSource,
  resolveBankLogoSourcesForRuntime,
} from '../data/bankBrand';
import { useStore } from '../data/store';
import type { LogoRenderState } from '../lib/logoReadiness';
import { isPerformanceAuditActive, subscribePerformanceAudit } from '../lib/performanceAudit';
import { useTheme } from '../theme/ThemeProvider';
import { uiBankInitials, uiProviderName } from '../lib/uiCopy';

function contrastText(hex: string): string {
  const c = hex.replace('#', '');
  if (c.length < 6) return '#ffffff';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#0b1220' : '#ffffff';
}

export function BankAvatar({
  provider,
  size = 42,
  width = size,
  height = size,
  inset = size * 0.06,
  onAssetPending,
  onAssetTerminal,
  renderStateId,
  onRenderStateChange,
}: {
  provider: string;
  size?: number;
  width?: number;
  height?: number;
  inset?: number;
  onAssetPending?: (provider: string) => void;
  onAssetTerminal?: (result: { provider: string; status: 'loaded' | 'fallback' }) => void;
  renderStateId?: string;
  onRenderStateChange?: (id: string, state: LogoRenderState) => void;
}) {
  const theme = useTheme();
  const brand = useStore((s) => s.core?.brands?.[provider]);
  const auditOwnsNetwork = useSyncExternalStore(
    subscribePerformanceAudit,
    isPerformanceAuditActive,
    isPerformanceAuditActive,
  );
  const remoteLogo = brand?.logo_uri ?? brand?.logo_svg_uri;
  const sources = useMemo(
    () => resolveBankLogoSourcesForRuntime(
      provider,
      brand?.logo,
      remoteLogo,
      auditOwnsNetwork,
    ),
    [auditOwnsNetwork, provider, brand?.logo, remoteLogo],
  );
  const [prevSources, setPrevSources] = useState(sources);
  const [sourceIdx, setSourceIdx] = useState(0);
  const [exhausted, setExhausted] = useState(false);
  const [decoded, setDecoded] = useState(false);

  if (sources !== prevSources) {
    setPrevSources(sources);
    setSourceIdx(0);
    setExhausted(false);
    setDecoded(false);
  }

  const color = brand?.color ?? theme.colors.chipText;
  const short = uiBankInitials({ provider }, brand);
  const markSize = Math.min(width, height);
  const fontSize = short.length <= 3 ? markSize * 0.34 : markSize * 0.26;
  const imageWidth = Math.max(0, width - 2 * inset), imageHeight = Math.max(0, height - 2 * inset);
  const activeSource = sources[sourceIdx];
  const terminalState = decoded
    ? 'decoded' as const
    : activeSource == null || exhausted
      ? 'initials' as const
      : null;
  const stateId = renderStateId ?? provider;

  useEffect(() => {
    if (activeSource == null || exhausted) {
      onAssetTerminal?.({ provider, status: 'fallback' });
    } else {
      onAssetPending?.(provider);
    }
  }, [activeSource, exhausted, onAssetPending, onAssetTerminal, provider]);

  useEffect(() => {
    onRenderStateChange?.(stateId, terminalState ?? 'pending');
  }, [onRenderStateChange, stateId, terminalState]);

  useEffect(() => () => {
    onRenderStateChange?.(stateId, 'unmounted');
  }, [onRenderStateChange, stateId]);

  if (activeSource != null && !exhausted) {
    const advanceSource = () => {
      setDecoded(false);
      if (sourceIdx + 1 < sources.length) setSourceIdx((idx) => idx + 1);
      else setExhausted(true);
    };
    return (
      <View
        style={{
          width,
          height,
          borderRadius: markSize / 4,
          backgroundColor: '#ffffff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessible
        accessibilityLabel={uiProviderName({ provider })}
      >
        {isSvgLogoSource(activeSource) ? (
          <SvgUri
            uri={activeSource as string}
            width={imageWidth}
            height={imageHeight}
            preserveAspectRatio="xMidYMid meet"
            onLoad={() => {
              setDecoded(true);
              onAssetTerminal?.({ provider, status: 'loaded' });
            }}
            onError={advanceSource}
          />
        ) : (
          <Image
            accessible={false}
            source={typeof activeSource === 'number' ? activeSource : { uri: activeSource }}
            resizeMode="contain"
            style={{ width: imageWidth, height: imageHeight }}
            onLoad={() => {
              setDecoded(true);
              onAssetTerminal?.({ provider, status: 'loaded' });
            }}
            onError={advanceSource}
          />
        )}
      </View>
    );
  }

  return (
    <View
      style={{
        width,
        height,
        borderRadius: markSize / 4,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessible
      accessibilityLabel={uiProviderName({ provider })}
    >
      <Text accessible={false} allowFontScaling={false} style={{ color: contrastText(color), ...fontStyle('700'), fontSize }}>
        {short}
      </Text>
    </View>
  );
}
