import { requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import type { ViewProps } from 'react-native';

const NativeAuditScreenAwake = requireNativeViewManager<ViewProps>('ArAuditScreenAwake');

export function AuditScreenAwake() {
  return (
    <NativeAuditScreenAwake
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', width: 1, height: 1, top: 0, left: 0 }}
    />
  );
}
