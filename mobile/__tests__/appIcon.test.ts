import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Circle, Line, Polyline } from 'react-native-svg';
import AppIcon, { APP_ICON_MAP } from '../src/components/icons/AppIcon';

jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));

describe('Rate Ledger app icon bridge', () => {
  it('maps every retained control vocabulary entry to local semantic geometry', () => {
    expect(Object.keys(APP_ICON_MAP).length).toBeGreaterThanOrEqual(60);
    expect(Object.values(APP_ICON_MAP).every(Boolean)).toBe(true);
  });

  it('keeps core rate concepts distinct', () => {
    expect(APP_ICON_MAP.home).toBe('home');
    expect(APP_ICON_MAP.wallet).toBe('wallet');
    expect(APP_ICON_MAP.time).toBe('time');
    expect(APP_ICON_MAP['git-compare']).toBe('compare');
    expect(APP_ICON_MAP['shield-checkmark-outline']).toBe('shield');
    expect(APP_ICON_MAP.star).toBe('star-filled');
    expect(APP_ICON_MAP['star-outline']).toBe('star');
  });

  it('renders Sort as two distinct opposing arrows within the native SVG bounds', () => {
    let tree: any;
    act(() => { tree = TestRenderer.create(React.createElement(AppIcon, { name: 'swap-vertical', size: 24, color: '#13579b' })); });
    try {
      const shafts = tree.root.findAllByType(Line).map((node: any) => node.props);
      const heads = tree.root.findAllByType(Polyline).map((node: any) => node.props);
      expect(APP_ICON_MAP['swap-vertical']).toBe('sort');
      expect(shafts).toHaveLength(2);
      expect(heads).toHaveLength(2);
      expect(new Set(shafts.map((shaft: any) => Number(shaft.x1))).size).toBe(2);
      expect(shafts.map((shaft: any) => Math.sign(Number(shaft.y2) - Number(shaft.y1))).sort()).toEqual([-1, 1]);
      for (const shaft of shafts) {
        expect(shaft.x1).toBe(shaft.x2);
        expect(shaft.stroke).toBe('#13579b');
        expect(shaft.fill).toBe('none');
        for (const coordinate of [shaft.x1, shaft.y1, shaft.x2, shaft.y2].map(Number)) {
          expect(coordinate).toBeGreaterThanOrEqual(0);
          expect(coordinate).toBeLessThanOrEqual(24);
        }
        expect(heads.some((head: any) => head.points.split(' ').map(Number)
          .some((coordinate: number, index: number, coordinates: number[]) => index % 2 === 0
            && coordinate === Number(shaft.x2) && coordinates[index + 1] === Number(shaft.y2)))).toBe(true);
      }
    } finally { act(() => tree.unmount()); }
  });

  it('renders More as three separated horizontal dots without altering its requested colour', () => {
    let tree: any;
    act(() => { tree = TestRenderer.create(React.createElement(AppIcon, { name: 'ellipsis-horizontal', size: 24, color: '#13579b' })); });
    try {
      const dots = tree.root.findAllByType(Circle).map((node: any) => node.props);
      expect(APP_ICON_MAP['ellipsis-horizontal']).toBe('more');
      expect(dots).toHaveLength(3);
      expect(tree.root.findAllByType(Line)).toHaveLength(0);
      expect(new Set(dots.map((dot: any) => Number(dot.cy))).size).toBe(1);
      const centers = dots.map((dot: any) => Number(dot.cx));
      expect(centers[0]).toBeLessThan(centers[1]);
      expect(centers[1]).toBeLessThan(centers[2]);
      for (const dot of dots) {
        expect(dot.fill).toBe('#13579b');
        expect(Number(dot.r)).toBeGreaterThan(0);
        expect(Number(dot.r) * 2).toBeLessThan(Math.min(centers[1] - centers[0], centers[2] - centers[1]));
        for (const edge of [Number(dot.cx) - Number(dot.r), Number(dot.cx) + Number(dot.r), Number(dot.cy) - Number(dot.r), Number(dot.cy) + Number(dot.r)]) {
          expect(edge).toBeGreaterThanOrEqual(0);
          expect(edge).toBeLessThanOrEqual(24);
        }
      }
    } finally { act(() => tree.unmount()); }
  });
});
