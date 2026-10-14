import React from 'react';
import mockReact from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppNavigationMenu, NavigationMenuProvider } from '../src/components/AppNavigationMenu';
import { PressFeedback } from '../src/components/PressFeedback';
import { TouchTarget } from '../src/components/TouchTarget';
import { LedgerRow } from '../src/components/ledger/LedgerRow';
import { DisclosureGroup, NavRow } from '../src/components/settings/settingsUi';
import { AppText, Button, Chip, Disclosure } from '../src/components/ui';

jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => jest.requireActual('../src/theme/theme').lightTheme }));
jest.mock('../src/data/store', () => ({ useStore: (selector: (state: { hydrated: boolean }) => unknown) => selector({ hydrated: true }) }));
jest.mock('expo-router', () => ({ usePathname: () => '/rates' }));
jest.mock('../src/lib/primaryNavigation', () => ({ navigateToAppDestination: jest.fn() }));
jest.mock('../src/components/SheetSurface', () => ({ SheetSurface: ({ children }: { children: React.ReactNode }) => mockReact.createElement('View', null, children) }));
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => ({ __esModule: true, default: ({ children, ...props }: any) => mockReact.createElement('Pressable', props, typeof children === 'function' ? children({ pressed: false }) : children) }));

type Node = {
  props: Record<string, any>;
  findAll: (predicate: (node: Node) => boolean) => Node[];
  findByType: (type: unknown) => Node;
  findAllByType: (type: unknown) => Node[];
};
type Renderer = ReactTestRenderer & { root: Node };

function animatedContent(node: Node) {
  const layer = node.findAll(candidate => Array.isArray(candidate.props.style)
    && StyleSheet.flatten(candidate.props.style)?.transform !== undefined)[0];
  expect(layer).toBeDefined();
  return StyleSheet.flatten(layer.props.style);
}

test('Account destinations give every visible title full row space between its icons', () => {
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(<NavigationMenuProvider><AppNavigationMenu /></NavigationMenuProvider>) as Renderer; });
  try {
    const targets = tree.root.findAllByType(TouchTarget);
    expect(targets.map(target => target.props.accessibilityLabel)).toEqual(['Profile', 'Settings', 'About']);
    for (const target of targets) {
      expect(target.props.fill).toBe(true);
      const pressable = target.findByType(Pressable);
      const bounds = StyleSheet.flatten(pressable.props.style({ pressed: false }));
      expect(bounds).toMatchObject({ width: '100%', minHeight: 48, minWidth: 48, flexDirection: 'row' });
      expect(animatedContent(target)).toMatchObject({ width: '100%', flexDirection: 'row', flexGrow: 0 });
      expect(target.findByType(AppText).props.children).toBe(target.props.accessibilityLabel);
      expect(StyleSheet.flatten(target.findByType(AppText).props.style).flex).toBe(1);
    }
  } finally { act(() => tree.unmount()); }
});

test.each([
  ['Disclosure', <Disclosure title="Rate details" open={false} onToggle={() => {}}><View /></Disclosure>],
  ['LedgerRow', <LedgerRow title="Profile" onPress={() => {}} />],
  ['Settings disclosure', <DisclosureGroup title="Privacy"><View /></DisclosureGroup>],
  ['Settings destination', <NavRow label="Settings" icon="settings" onPress={() => {}} />],
])('%s supplies definite animated width for its flexing title', (_name, element) => {
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(element) as Renderer; });
  try {
    const target = tree.root.findByType(PressFeedback);
    expect(animatedContent(target)).toMatchObject({ width: '100%', flexDirection: 'row' });
    const pressable = target.findByType(Pressable);
    const style = typeof pressable.props.style === 'function'
      ? pressable.props.style({ pressed: false }) : pressable.props.style;
    const bounds = StyleSheet.flatten(style);
    expect(bounds.minHeight).toBeGreaterThanOrEqual(48);
    expect(bounds.transform).toBeUndefined();
  } finally { act(() => tree.unmount()); }
});

test.each([
  ['Chip', <Chip label="Comparison rate" onPress={() => {}} />],
  ['Button', <Button title="Compare" onPress={() => {}} />],
])('%s retains intrinsic animated width', (_name, element) => {
  let tree!: Renderer;
  act(() => { tree = TestRenderer.create(element) as Renderer; });
  try {
    const content = animatedContent(tree.root.findByType(PressFeedback));
    expect(content.flexGrow).toBe(0);
    expect(content.width).toBeUndefined();
  } finally { act(() => tree.unmount()); }
});
