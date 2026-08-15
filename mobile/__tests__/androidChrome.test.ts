import { Platform } from 'react-native';

import {
  getTabBarContentHeight,
  getTabBarLayout,
  IOS_TAB_BAR_HEIGHT,
  M3_NAV_BAR_HEIGHT,
} from '../src/lib/androidChrome';

describe('getTabBarContentHeight', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  });

  it('returns M3 height on Android', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    expect(getTabBarContentHeight()).toBe(M3_NAV_BAR_HEIGHT);
  });

  it('returns iOS default height on iOS', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
    expect(getTabBarContentHeight()).toBe(IOS_TAB_BAR_HEIGHT);
  });

  it('reserves two label lines and extra height at 200% font scaling', () => {
    expect(getTabBarLayout(2, 'android')).toEqual({
      contentHeight: 92,
      labelLines: 2,
    });
    expect(getTabBarLayout(2, 'ios')).toEqual({
      contentHeight: 88,
      labelLines: 2,
    });
  });

  it('keeps normal text on one line and sanitizes invalid font scales', () => {
    expect(getTabBarLayout(1, 'android')).toEqual({
      contentHeight: M3_NAV_BAR_HEIGHT,
      labelLines: 1,
    });
    expect(getTabBarLayout(Number.NaN, 'ios')).toEqual({
      contentHeight: IOS_TAB_BAR_HEIGHT,
      labelLines: 1,
    });
  });

  it('continues growing through the supported accessibility range', () => {
    expect(getTabBarLayout(3, 'android').contentHeight)
      .toBeGreaterThan(getTabBarLayout(2, 'android').contentHeight);
  });
});
