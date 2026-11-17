import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Keyboard, Modal, Platform, Share } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import AboutScreen from '../app/about';
import { SheetSurface } from '../src/components/SheetSurface';

jest.mock('react-native-qrcode-svg', () => () => null);
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: object) => unknown) => selector({}) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }) }));
jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/config', () => ({
  APK_RELEASE_TAG: 'app-apk-latest',
  APK_REPO: 'yanniedog/AR-app',
  IOS_INSTALL_URL: null,
  PLAY_STORE_URL: 'https://play.google.com/store/apps/details?id=com.eyex.australianrates',
  SELF_UPDATE_ENABLED: true,
}));

it('opens the app QR from About and shares its exact install link', async () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'android');
  const keyboard = jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
  let tree!: ReturnType<typeof TestRenderer.create>;
  try {
    act(() => { tree = TestRenderer.create(<AboutScreen />); });
    const control = (label: string) => tree.root.findAll(node => node.props.accessibilityLabel === label
      && typeof node.props.onPress === 'function')[0];
    expect(tree.root.findByType(SheetSurface).props.visible).toBe(false);
    act(() => control('Share app').props.onPress());
    expect(tree.root.findByType(SheetSurface).props.visible).toBe(true);
    expect(tree.root.findByProps({ accessibilityLabel: 'App install QR code' }).props.accessibilityRole).toBe('image');
    const qrUrl = tree.root.findByType(QRCode).props.value;
    expect(qrUrl).toBe('https://github.com/yanniedog/AR-app/releases/tag/app-apk-latest');
    await act(async () => { control('Share link').props.onPress(); });
    expect(share).toHaveBeenCalledWith({ title: 'Australian Rates', message: qrUrl });
    act(() => tree.root.findByType(Modal).props.onRequestClose());
    expect(tree.root.findByType(SheetSurface).props.visible).toBe(false);
  } finally {
    if (tree) act(() => tree.unmount());
    share.mockRestore();
    keyboard.mockRestore();
    platform.restore();
  }
});
