import React from 'react';
import {
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { PressFeedback, type PressFeedbackProps } from './PressFeedback';

/** Material / WCAG 2.5.5 minimum touch target (dp). */
export const TOUCH_TARGET_MIN = 48;

export const DEFAULT_HIT_SLOP = { top: 0, bottom: 0, left: 0, right: 0 };

export type TouchTargetProps = PressFeedbackProps & {
  /** Centre square icon buttons. All targets retain a 48 dp minimum width. */
  square?: boolean;
  /** Stretch to fill parent width (settings rows, list actions). */
  fill?: boolean;
};

export function TouchTarget({
  children,
  style,
  hitSlop = DEFAULT_HIT_SLOP,
  square = false,
  fill = false,
  ...rest
}: TouchTargetProps) {
  const base: ViewStyle = {
    minHeight: TOUCH_TARGET_MIN,
    minWidth: TOUCH_TARGET_MIN,
    alignItems: 'center',
  };
  if (square) {
    base.justifyContent = 'center';
  }
  if (fill) {
    base.alignSelf = 'stretch';
    base.width = '100%';
  }

  const resolveStyle = (
    state: PressableStateCallbackType,
  ): StyleProp<ViewStyle> => {
    const resolved = typeof style === 'function' ? style(state) : style;
    return [base, resolved];
  };

  return (
    <PressFeedback hitSlop={hitSlop} style={resolveStyle} {...rest}>
      {children}
    </PressFeedback>
  );
}
