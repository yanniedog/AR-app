import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Switch, View } from 'react-native';

import { TOUCH_TARGET_MIN, TouchTarget } from '../TouchTarget';
import { AppText, Card, IconButton, Row } from '../ui';
import { useTheme } from '../../theme/ThemeProvider';

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <AppText
        variant="tiny"
        weight="700"
        color="textFaint"
        style={{ marginBottom: 8, marginLeft: 4, letterSpacing: 0.6 }}
      >
        {title.toUpperCase()}
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
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View>
      <TouchTarget
        fill
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityHint={open ? `Hide ${title}` : `Show ${title}`}
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
          {summary && !open ? (
            <AppText variant="tiny" color="textFaint" numberOfLines={1}>
              {summary}
            </AppText>
          ) : null}
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
  sub,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <TouchTarget
      fill
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}. ${sub}` : label}
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
        {sub ? (
          <AppText variant="tiny" color="textFaint" numberOfLines={2}>
            {sub}
          </AppText>
        ) : null}
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
  title: string;
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
          accessibilityLabel={`Move ${title} up`}
        />
        <IconButton
          icon="chevron-down"
          onPress={onMoveDown}
          disabled={!canMoveDown}
          accessibilityLabel={`Move ${title} down`}
        />
        <IconButton
          icon="close"
          onPress={onRemove}
          disabled={!canRemove}
          accessibilityLabel={`Remove ${title}`}
        />
      </Row>
    </Row>
  );
}

export function Label({ text }: { text: string }) {
  return (
    <AppText variant="tiny" weight="600" color="textMuted" style={{ marginBottom: 8 }}>
      {text}
    </AppText>
  );
}

export function ToggleRow({
  icon,
  label,
  sub,
  value,
  onChange,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <Row gap={12} style={{ minHeight: TOUCH_TARGET_MIN, paddingVertical: 2 }}>
      <Ionicons name={icon} size={20} color={theme.colors.primary} />
      <View style={{ flex: 1 }}>
        <AppText variant="body" weight="600">
          {label}
        </AppText>
        {sub ? (
          <AppText variant="tiny" color="textFaint" numberOfLines={2}>
            {sub}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
        accessibilityLabel={label}
        accessibilityHint={sub}
      />
    </Row>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6, minHeight: 36 }}>
      <AppText variant="small" color="textMuted" style={{ flexShrink: 0 }}>
        {label}
      </AppText>
      <AppText variant="small" weight="600" style={{ flexShrink: 1, textAlign: 'right', marginLeft: 12 }}>
        {value}
      </AppText>
    </Row>
  );
}
