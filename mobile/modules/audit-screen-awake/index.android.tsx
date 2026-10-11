import { requireNativeViewManager, requireOptionalNativeModule } from 'expo-modules-core';
import React from 'react';
import type { ViewProps } from 'react-native';

// Expo Go and older development clients do not contain local native modules.
const NativeAuditScreenAwake = requireOptionalNativeModule('ArAuditScreenAwake')
  ? requireNativeViewManager<ViewProps>('ArAuditScreenAwake')
  : null;

export function AuditScreenAwake() {
  if (!NativeAuditScreenAwake) return null;
  return (
    <NativeAuditScreenAwake
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', width: 1, height: 1, top: 0, left: 0 }}
    />
  );
}
