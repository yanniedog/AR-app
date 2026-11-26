import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { hapticSelection } from '../lib/haptics';
import { uiCount, uiJoin, type UiChild, type UiCopy } from '../lib/uiCopy';
import { fontStyle } from '../theme/fonts';
import { useTheme } from '../theme/ThemeProvider';
import { LedgerIcon } from './icons/LedgerIcon';
import { SheetSurface } from './SheetSurface';
import { TouchTarget } from './TouchTarget';
import { androidRipple, AppText, Button } from './ui';

export interface SelectorOption<T extends string> { label: UiCopy; value: T; disabled?: boolean }

const STRIP_HEIGHT = 34;
const FADE_WIDTH = 28;

/** Right or left edge fade that hints at more options without a scrollbar. */
function EdgeFade({ side, color }: { side: 'left' | 'right'; color: string }) {
  const id = `strip-fade-${side}`;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, bottom: 0, width: FADE_WIDTH, [side]: 0 }}>
      <Svg width="100%" height="100%" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Defs>
          <LinearGradient id={id} x1={side === 'right' ? '0' : '1'} y1="0" x2={side === 'right' ? '1' : '0'} y2="0">
            <Stop offset="0" stopColor={color} stopOpacity="0" />
            <Stop offset="1" stopColor={color} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * One calm line of options, like a trading app's timeframe bar. Unselected options
 * are plain text; the selection sits on a soft tinted lozenge. Overflow scrolls
 * sideways with faded edges, and the selection is kept in view.
 */
export function OptionStrip<T extends string>({
  options, value, onChange, label, multiple = false, style, auditId, background,
}: {
  options: readonly SelectorOption<T>[];
  /** One value, or the selected values when `multiple`. */
  value: T | null | readonly T[];
  onChange: (value: T) => void;
  label?: UiCopy;
  multiple?: boolean;
  style?: StyleProp<ViewStyle>;
  auditId?: string;
  /** Colour behind the strip, used for the edge fades. */
  background?: string;
}) {
  const theme = useTheme();
  const scroll = useRef<ScrollView>(null);
  const positions = useRef(new Map<T, { x: number; width: number }>());
  const [frame, setFrame] = useState({ width: 0, content: 0, offset: 0 });
  const selected = useMemo(() => new Set<T>(Array.isArray(value) ? value as readonly T[] : value == null ? [] : [value as T]), [value]);
  const first = options.find(option => selected.has(option.value))?.value;

  const reveal = useCallback((target: T | undefined, animated: boolean) => {
    const at = target === undefined ? undefined : positions.current.get(target);
    if (!at || !frame.width) return;
    if (at.x >= frame.offset && at.x + at.width <= frame.offset + frame.width) return;
    scroll.current?.scrollTo({ x: Math.max(0, at.x - frame.width / 2 + at.width / 2), animated });
  }, [frame.offset, frame.width]);
  const revealed = useRef(false);
  useEffect(() => {
    if (!revealed.current && frame.width && first !== undefined && positions.current.has(first)) {
      revealed.current = true;
      reveal(first, false);
    }
  }, [first, frame.width, reveal]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offset = event.nativeEvent.contentOffset.x;
    setFrame(current => Math.abs(current.offset - offset) < 1 ? current : { ...current, offset });
  };
  const overflow = frame.content > frame.width + 1;
  const fadeColor = background ?? theme.colors.bg;

  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: STRIP_HEIGHT }, style]}>
      {label ? (
        <AppText variant="small" color="textMuted" weight="500" numberOfLines={1} style={{ flexShrink: 0 }}>{label}</AppText>
      ) : null}
      <View
        style={{ flex: 1, minWidth: 0 }}
        onLayout={(event: LayoutChangeEvent) => {
          const width = event.nativeEvent.layout.width;
          setFrame(current => current.width === width ? current : { ...current, width });
        }}
      >
        <ScrollView
          ref={scroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          onContentSizeChange={(content) => setFrame(current => current.content === content ? current : { ...current, content })}
          contentContainerStyle={{ alignItems: 'center', gap: 2, paddingRight: overflow ? FADE_WIDTH / 2 : 0 }}
          accessibilityRole={multiple ? undefined : 'tablist'}
        >
          {options.map(option => {
            const active = selected.has(option.value);
            return (
              <TouchTarget
                key={option.value}
                auditControlId={auditId ? `${auditId}:${option.value}` : `option-strip:${JSON.stringify(options.map(item => item.value))}:${option.value}`}
                onLayout={(event: LayoutChangeEvent) => {
                  const { x, width } = event.nativeEvent.layout;
                  positions.current.set(option.value, { x, width });
                }}
                onPress={() => {
                  if (option.disabled) return;
                  if (!active || multiple) hapticSelection();
                  onChange(option.value);
                  reveal(option.value, true);
                }}
                disabled={option.disabled}
                hitSlop={{ top: 6, bottom: 6 }}
                accessibilityRole={multiple ? 'checkbox' : 'tab'}
                accessibilityLabel={option.label}
                accessibilityState={multiple ? { checked: active, disabled: !!option.disabled } : { selected: active, disabled: !!option.disabled }}
                android_ripple={androidRipple(theme.colors.primaryMuted)}
                style={{
                  height: STRIP_HEIGHT - 4,
                  minWidth: 40,
                  paddingHorizontal: 12,
                  borderRadius: 9,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: active ? theme.colors.primaryMuted : 'transparent',
                  opacity: option.disabled ? 0.4 : 1,
                  overflow: 'hidden',
                }}
              >
                <AppText
                  variant="small"
                  numberOfLines={1}
                  style={{ color: active ? theme.colors.primary : theme.colors.textMuted, ...fontStyle(active ? '600' : '500') }}
                >
                  {option.label}
                </AppText>
              </TouchTarget>
            );
          })}
        </ScrollView>
        {overflow && frame.offset > 2 ? <EdgeFade side="left" color={fadeColor} /> : null}
        {overflow && frame.offset + frame.width < frame.content - 2 ? <EdgeFade side="right" color={fadeColor} /> : null}
      </View>
    </View>
  );
}

/** Short summary of a selection for a collapsed row. */
export function selectionSummary<T extends string>(options: readonly SelectorOption<T>[], selected: readonly T[], empty: UiCopy = 'Any'): UiCopy {
  const picked = options.filter(option => selected.includes(option.value));
  if (!picked.length) return empty;
  if (picked.length === 1) return picked[0].label;
  return uiJoin(picked[0].label, ' ', '+', uiCount(picked.length - 1));
}

/**
 * A collapsed field: one quiet row showing its label and current choice. Tapping
 * it opens a sheet with a tick list. Multi-select keeps the sheet open; single
 * select closes it on choice.
 */
export function OptionSelect<T extends string>({
  label, options, value, onChange, multiple = false, emptyLabel = 'Any', onClear, auditId, last = false, variant = 'row', icon,
}: {
  label: UiCopy;
  options: readonly SelectorOption<T>[];
  value: T | null | readonly T[];
  onChange: (value: T) => void;
  multiple?: boolean;
  emptyLabel?: UiCopy;
  /** Shown as the first sheet row in multi-select mode. */
  onClear?: () => void;
  auditId?: string;
  last?: boolean;
  /** `row`: a full-width field. `button`: an icon and the current choice, for a toolbar line. */
  variant?: 'row' | 'button';
  icon?: React.ComponentProps<typeof LedgerIcon>['name'];
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = Array.isArray(value) ? value as readonly T[] : value == null ? [] : [value as T];
  const summary = selectionSummary(options, selected, emptyLabel);
  const active = selected.length > 0;
  const trigger = variant === 'button' ? (
    <TouchTarget
      auditControlId={auditId ? `${auditId}:open` : undefined}
      onPress={() => setOpen(true)}
      accessibilityRole="button"
      accessibilityLabel={uiJoin(label, ': ', summary)}
      android_ripple={androidRipple(theme.colors.primaryMuted)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingLeft: 10, paddingRight: 8,
        borderRadius: 9, backgroundColor: theme.colors.surfaceAlt, overflow: 'hidden', maxWidth: '100%',
      }}
    >
      {icon ? <LedgerIcon name={icon} size={16} color={theme.colors.primary} /> : null}
      <AppText variant="small" numberOfLines={1} style={{ flexShrink: 1, color: theme.colors.text, ...fontStyle('600') }}>{summary}</AppText>
      <LedgerIcon name="chevron-down" size={14} color={theme.colors.textMuted} />
    </TouchTarget>
  ) : null;
  return (
    <>
      {trigger ?? <TouchTarget
        auditControlId={auditId ? `${auditId}:open` : undefined}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={uiJoin(label, ': ', summary)}
        android_ripple={androidRipple(theme.colors.primaryMuted)}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 10,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
        }}
      >
        <AppText variant="body" color="textMuted" numberOfLines={1} style={{ flexShrink: 0 }}>{label}</AppText>
        <AppText
          variant="body"
          numberOfLines={1}
          style={{ flex: 1, textAlign: 'right', color: active ? theme.colors.primary : theme.colors.text, ...fontStyle(active ? '600' : '500') }}
        >
          {summary}
        </AppText>
        <LedgerIcon name="chevron-down" size={18} color={theme.colors.textMuted} />
      </TouchTarget>}
      <SheetSurface
        visible={open}
        title={label}
        onClose={() => setOpen(false)}
        footer={multiple ? <Button title="Done" onPress={() => setOpen(false)} /> : undefined}
      >
        <View>
          {multiple && onClear ? (
            <SelectRow label={emptyLabel} checked={!active} multiple={false} onPress={() => { if (active) { hapticSelection(); onClear(); } }} />
          ) : null}
          {options.map(option => (
            <SelectRow
              key={option.value}
              label={option.label}
              checked={selected.includes(option.value)}
              multiple={multiple}
              disabled={option.disabled}
              auditId={auditId ? `${auditId}:${option.value}` : undefined}
              onPress={() => {
                hapticSelection();
                onChange(option.value);
                if (!multiple) setOpen(false);
              }}
            />
          ))}
        </View>
      </SheetSurface>
    </>
  );
}

function SelectRow({ label, checked, multiple, onPress, disabled, auditId }: {
  label: UiCopy; checked: boolean; multiple: boolean; onPress: () => void; disabled?: boolean; auditId?: string;
}) {
  const theme = useTheme();
  return (
    <TouchTarget
      auditControlId={auditId}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityLabel={label}
      accessibilityState={multiple ? { checked, disabled: !!disabled } : { selected: checked, disabled: !!disabled }}
      android_ripple={androidRipple(theme.colors.primaryMuted)}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 4,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border, opacity: disabled ? 0.4 : 1,
      }}
    >
      <AppText variant="body" numberOfLines={2} style={{ flex: 1, color: checked ? theme.colors.text : theme.colors.textMuted, ...fontStyle(checked ? '600' : '400') }}>
        {label}
      </AppText>
      {multiple ? (
        <LedgerIcon name={checked ? 'checkbox' : 'checkbox-empty'} size={22} color={checked ? theme.colors.primary : theme.colors.border} />
      ) : checked ? (
        <LedgerIcon name="success" size={20} color={theme.colors.primary} />
      ) : <View style={{ width: 20 }} />}
    </TouchTarget>
  );
}

/** Wraps an existing set of Chip toggles in one sideways-scrolling line. */
export function ChipStrip({ children, style }: { children: UiChild; style?: StyleProp<ViewStyle> }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[{ flexGrow: 0 }, style]}
      contentContainerStyle={{ alignItems: 'center', gap: 6 }}
    >
      {children}
    </ScrollView>
  );
}
