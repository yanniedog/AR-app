import React from 'react';
import { Modal, Pressable, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../theme/ThemeProvider';
import { LedgerIcon } from '../icons/LedgerIcon';
import { LedgerText } from './LedgerText';

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
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={visible}
      animationType={reducedMotion === false ? 'slide' : 'none'}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          accessible={false}
          accessibilityElementsHidden
          onPress={onClose}
          style={{ ...StyleSheetAbsoluteFill, backgroundColor: theme.ledger.scrim }}
        />
        <SafeAreaView
          edges={['bottom']}
          accessibilityViewIsModal
          style={[
            {
              maxHeight: '88%',
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 8,
              backgroundColor: theme.ledger.raised,
              borderTopLeftRadius: 18,
              borderTopRightRadius: 18,
              gap: 12,
            },
            style,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <LedgerText variant="heading" style={{ flex: 1 }}>{title}</LedgerText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Close ${title}`}
              onPress={onClose}
              hitSlop={8}
              style={({ pressed }) => ({
                minWidth: 48,
                minHeight: 48,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: pressed ? 0.58 : 1,
              })}
            >
              <LedgerIcon name="close" color={theme.ledger.ink} />
            </Pressable>
          </View>
          {children}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const StyleSheetAbsoluteFill = {
  position: 'absolute',
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
} as const;
