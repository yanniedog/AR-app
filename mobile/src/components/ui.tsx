import Ionicons from './icons/AppIcon';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  type TextProps,
  useWindowDimensions,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { hapticLightImpact, hapticSelection } from '../lib/haptics';
import type { Palette } from '../theme/colors';
import { commissionerFamily, newsreaderFamily, type LedgerUiWeight } from '../theme/fonts';
import type { FontVariant } from '../theme/theme';
import { useTheme } from '../theme/ThemeProvider';
import { TouchTarget } from './TouchTarget';

const VARIANT_WEIGHT: Partial<Record<FontVariant, LedgerUiWeight>> = {
  h1: '600',
  h2: '600',
  h3: '600',
  rate: '700',
  rateHero: '700',
};

export function androidRipple(color: string, borderless = false) {
  return Platform.OS === 'android' ? { color, borderless } : undefined;
}

function pressedOpacity(pressed: boolean, amount = 0.7): { opacity: number } | Record<string, never> {
  return Platform.OS !== 'android' && pressed ? { opacity: amount } : {};
}

export function AppText({
  variant = 'body',
  color = 'text',
  weight,
  style,
  ...rest
}: TextProps & {
  variant?: FontVariant;
  color?: keyof Palette;
  weight?: '400' | '500' | '600' | '700' | '800';
}) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const requestedWeight = weight === '800' ? '700' : (weight ?? VARIANT_WEIGHT[variant] ?? '400');
  const heading = variant === 'h1' || variant === 'h2' || variant === 'h3';
  const fontFamily = heading
    ? newsreaderFamily(requestedWeight === '600' || requestedWeight === '700' ? '600' : '500')
    : commissionerFamily(requestedWeight);
  return (
    <Text
      allowFontScaling
      style={[
        {
          color: theme.colors[color],
          fontSize: theme.font[variant],
          // Fixed line heights clip glyphs at large accessibility text sizes.
          lineHeight: fontScale > 1 ? undefined : theme.lineHeight[variant],
          fontFamily,
        },
        variant === 'h1' && { letterSpacing: -0.35 },
        variant === 'h2' && { letterSpacing: -0.2 },
        variant === 'rateHero' && { letterSpacing: -0.5 },
        (variant === 'rate' || variant === 'rateHero') && { fontVariant: ['tabular-nums'] },
        style,
        // Compact caller overrides are useful at normal scale, but become
        // clipping constraints once the OS enlarges the glyphs.
        fontScale > 1 && { lineHeight: undefined },
      ]}
      {...rest}
    />
  );
}

export function Card({
  style,
  children,
  variant = 'plain',
  ...rest
}: ViewProps & { variant?: 'plain' | 'outlined' | 'elevated' }) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.card,
          borderRadius: theme.radius.sm,
          padding: theme.spacing(4),
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: variant === 'elevated' ? theme.ledger.controlRule : theme.ledger.rule,
          ...(variant === 'outlined' ? { borderLeftWidth: 1, borderRightWidth: 1 } : null),
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

export function Row({ style, gap = 8, ...rest }: ViewProps & { gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]} {...rest} />;
}

export function Divider({ style }: { style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border }, style]} />
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  return (
    <TouchTarget
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      android_ripple={androidRipple(theme.colors.primaryMuted)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: selected ? theme.colors.primary : theme.colors.border,
        backgroundColor: selected ? theme.colors.primaryMuted : theme.colors.chip,
        overflow: 'hidden',
        ...pressedOpacity(pressed, 0.7),
      })}
    >
      {icon ? (
        <Ionicons
          name={icon}
          size={14}
          color={selected ? theme.colors.primary : theme.colors.chipText}
        />
      ) : null}
      <Text
        style={{
          color: selected ? theme.colors.primary : theme.colors.chipText,
          fontWeight: selected ? '700' : '500',
          fontSize: theme.font.small,
        }}
      >
        {label}
      </Text>
    </TouchTarget>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  hapticOnPress,
  accessibilityState,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  /** Light impact on press (e.g. filter Apply). */
  hapticOnPress?: boolean;
  accessibilityState?: PressableProps['accessibilityState'];
}) {
  const theme = useTheme();
  const bg =
    variant === 'primary'
      ? theme.ledger.wattle
      : variant === 'secondary'
        ? theme.ledger.raised
        : 'transparent';
  const fg = variant === 'primary' ? theme.ledger.onWattle : theme.ledger.ink;
  const rippleColor =
    variant === 'primary' ? theme.colors.onPrimary : theme.colors.primaryMuted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{
        ...accessibilityState,
        disabled: !!(disabled || loading),
        busy: !!loading,
      }}
      onPress={() => {
        if (hapticOnPress) hapticLightImpact();
        onPress?.();
      }}
      disabled={disabled || loading}
      android_ripple={androidRipple(rippleColor, variant === 'ghost')}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          paddingHorizontal: 18,
          paddingVertical: 13,
          borderRadius: theme.radius.sm,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: theme.ledger.controlRule,
          overflow: 'hidden',
          ...(disabled ? { opacity: 0.6 } : pressedOpacity(pressed, 0.85)),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
          <Text style={{ color: fg, fontFamily: commissionerFamily('700'), fontSize: theme.font.body }}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{ flex: 1, paddingRight: action ? 12 : 0 }}>
        <AppText variant="h3">{title}</AppText>
        {subtitle ? (
          <AppText variant="small" color="textMuted" style={{ marginTop: 2 }}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {action}
    </Row>
  );
}

export function Disclosure({
  title,
  summary,
  open,
  onToggle,
  children,
  icon = 'chevron-down',
}: {
  title: string;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const theme = useTheme();
  return (
    <Card variant="outlined" style={{ padding: 0, overflow: 'hidden' }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${open ? 'Hide' : 'Show'} ${title}`}
        accessibilityState={{ expanded: open }}
        android_ripple={androidRipple(theme.colors.primaryMuted)}
        style={{
          minHeight: 64,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: theme.spacing(4),
          paddingVertical: theme.spacing(3),
          gap: theme.spacing(3),
        }}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="700">{title}</AppText>
          {summary ? <AppText variant="small" color="textMuted">{summary}</AppText> : null}
        </View>
        <Ionicons
          name={open ? 'chevron-up' : icon}
          size={20}
          color={theme.colors.textMuted}
        />
      </Pressable>
      {open ? <View style={{ padding: theme.spacing(4), paddingTop: 0 }}>{children}</View> : null}
    </Card>
  );
}

export function IconButton({
  icon,
  onPress,
  color,
  size = 22,
  accessibilityLabel,
  disabled,
  style,
  ...rest
}: PressableProps & {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  color?: keyof Palette;
  size?: number;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        hapticSelection();
        onPress?.();
      }}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={androidRipple(theme.colors.primaryMuted, true)}
      style={({ pressed }) => [
        {
          minWidth: 48,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.sm,
          overflow: 'hidden',
          ...(disabled ? { opacity: 0.45 } : pressedOpacity(pressed, 0.6)),
        },
        style,
      ]}
      {...rest}
    >
      <Ionicons name={icon} size={size} color={theme.colors[color ?? 'text']} />
    </Pressable>
  );
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'success' | 'warning' | 'danger' | 'primary' }) {
  const theme = useTheme();
  const map: Record<string, string> = {
    muted: theme.colors.chipText,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
    primary: theme.colors.primary,
  };
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 2,
        backgroundColor: theme.colors.chip,
      }}
    >
      <Text style={{ color: map[tone], fontSize: theme.font.tiny, fontFamily: commissionerFamily('700') }}>{label}</Text>
    </View>
  );
}
