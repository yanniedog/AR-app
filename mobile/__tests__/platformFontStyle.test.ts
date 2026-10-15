import { Platform } from 'react-native';

import { fontStyle } from '../src/theme/fonts';

const original = Platform.OS;
afterEach(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: original }); });

test('Android retains real numeric weights with its system font', () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  expect(fontStyle('400')).toEqual({ fontFamily: 'sans-serif', fontWeight: '400' });
  expect(fontStyle('600')).toEqual({ fontFamily: 'sans-serif', fontWeight: '600' });
  expect(fontStyle('700')).toEqual({ fontFamily: 'sans-serif', fontWeight: '700' });
});

test.each(['ios', 'web'])('%s retains the static bundled face without synthetic bolding', (platform) => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  expect(fontStyle('600')).toEqual({ fontFamily: 'Commissioner_600SemiBold', fontWeight: 'normal' });
});
