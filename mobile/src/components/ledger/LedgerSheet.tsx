import React from 'react';
import { View, type ViewStyle } from 'react-native';
import { SheetSurface } from '../SheetSurface';

export function LedgerSheet({
  visible,
  title,
  onClose,
  children,
  style,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <SheetSurface visible={visible} title={title} onClose={onClose} style={style}>
      <View style={{ paddingHorizontal: 16, gap: 12, flexShrink: 1 }}>{children}</View>
    </SheetSurface>
  );
}
