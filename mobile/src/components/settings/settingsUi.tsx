import type { UiChild } from '../../lib/uiCopy';
import Ionicons from '../icons/AppIcon';
import React, { useState } from 'react';
import { Switch, useWindowDimensions, View } from 'react-native';

import { TOUCH_TARGET_MIN, TouchTarget } from '../TouchTarget';
import { AppText, Card, IconButton, Row } from '../ui';
import { useTheme } from '../../theme/ThemeProvider';
import { uiJoin, type UiCopy } from '../../lib/uiCopy';

export function Section({ title, children }: { title: UiCopy; children: UiChild }) {
  return (
    <View style={{ marginBottom: 22 }}>
      {/* Sentence case, per the design system's voice rules. */}
      <AppText
        variant="small"
        weight="600"
        color="textMuted"
        accessibilityRole="header"
        style={{ marginBottom: 8, marginLeft: 4 }}
      >
        {title}
      </AppText>
      <Card style={{ gap: 2 }}>{children}</Card>
    </View>
  );
}

/** Soft vertical gap between settings rows — quieter than a full divider. */
export function SettingsGap({ size = 10 }: { size?: number }) {
  return <View style={{ height: size }} />;
}

export function DisclosureGroup({
  title,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
}: {
  title: UiCopy;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: UiChild;
}) {
  const theme = useTheme();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const open = controlledOpen ?? internalOpen;
  const toggleOpen = () => {
    const next = !open;
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };

  return (
    <View>
      <TouchTarget
        fill
        onPress={toggleOpen}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={uiJoin(open ? 'Hide' : 'Show', ' ', title)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: TOUCH_TARGET_MIN,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="600">
            {title}
          </AppText>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={theme.colors.textMuted}
        />
      </TouchTarget>
      {open ? <View style={{ paddingTop: 4, gap: 4 }}>{children}</View> : null}
    </View>
  );
}

export function NavRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: UiCopy;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <TouchTarget
      fill
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: TOUCH_TARGET_MIN,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={20} color={theme.colors.primary} />
      <View style={{ flex: 1 }}>
        <AppText variant="body" weight="600">
          {label}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
    </TouchTarget>
  );
}

export function InterestOrderRow({
  title,
  canMoveUp,
  canMoveDown,
  canRemove,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  title: UiCopy;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canRemove: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 4, minHeight: TOUCH_TARGET_MIN }}>
      <AppText variant="body" weight="600" style={{ flex: 1 }}>
        {title}
      </AppText>
      <Row gap={4}>
        <IconButton
          icon="chevron-up"
          onPress={onMoveUp}
          disabled={!canMoveUp}
          accessibilityLabel={uiJoin('↑', ' ', title)}
        />
        <IconButton
          icon="chevron-down"
          onPress={onMoveDown}
          disabled={!canMoveDown}
          accessibilityLabel={uiJoin('↓', ' ', title)}
        />
        <IconButton
          icon="close"
          onPress={onRemove}
          disabled={!canRemove}
          accessibilityLabel={uiJoin('Remove', ' ', title)}
        />
      </Row>
    </Row>
  );
}

export function Label({ text }: { text: UiCopy }) {
  return (
    <AppText variant="tiny" weight="600" color="textMuted" style={{ marginBottom: 8 }}>
      {text}
    </AppText>
  );
}

export function ToggleRow({
  icon,
  label,
  value,
  onChange,
  disabled = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: UiCopy;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <TouchTarget
      fill
      accessible
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => { if (!disabled) onChange(!value); }}
      style={{ minHeight: TOUCH_TARGET_MIN, paddingVertical: 2, opacity: disabled ? 0.5 : 1 }}
    >
      <View
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        style={{ width: '100%', flexDirection: 'row', alignItems: 'center', gap: 12 }}
      >
        <Ionicons name={icon} size={20} color={theme.colors.primary} />
        <View style={{ flex: 1 }}>
          <AppText variant="body" weight="600">
            {label}
          </AppText>
        </View>
        <Switch
          value={value}
          disabled={disabled}
          accessible={false}
          focusable={false}
          trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        />
      </View>
    </TouchTarget>
  );
}

export function InfoRow({ label, value }: { label: UiCopy; value: UiCopy }) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 400 || fontScale >= 1.3;
  return (
    <Row gap={stacked ? 4 : 12} style={{ flexDirection: stacked ? 'column' : 'row',
      alignItems: stacked ? 'stretch' : 'flex-start', paddingVertical: 6, minHeight: 36 }}>
      <AppText variant="small" color="textMuted" style={{ flex: stacked ? undefined : 1, flexShrink: 1, minWidth: 0 }}>
        {label}
      </AppText>
      <AppText variant="small" weight="600" style={{ flex: stacked ? undefined : 1, flexShrink: 1, minWidth: 0,
        textAlign: stacked ? 'left' : 'right' }}>
        {value}
      </AppText>
    </Row>
  );
}
