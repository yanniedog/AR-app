import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { BackHandler, Keyboard, Modal } from 'react-native';
import { SheetSurface } from '../src/components/SheetSurface';
import { useBackOwnedSheetState, type SheetFocusOwner } from '../src/hooks/useBackOwnedSheetState';
import { uiLabel } from '../src/lib/uiCopy';

jest.mock('../src/hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ ledger: { scrim: '#00000066', raised: '#fff' }, radius: { lg: 24 } }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../src/components/ledger/LedgerText', () => ({ LedgerText: 'LedgerText' }));
jest.mock('../src/components/TouchTarget', () => ({ TouchTarget: 'TouchTarget' }));
jest.mock('../src/components/icons/LedgerIcon', () => ({ LedgerIcon: 'LedgerIcon' }));

type Renderer = ReactTestRenderer & { root: { findByType: (type: unknown) => { props: Record<string, any> } } };
let tree: Renderer | undefined, setOpen!: React.Dispatch<React.SetStateAction<boolean>>, visible = false;
let focused = true;
const backListeners: (() => boolean)[] = [], blurListeners = new Set<() => void>();
const navigation: SheetFocusOwner = { isFocused: () => focused, addListener: (_event, listener) => { blurListeners.add(listener); return () => { blurListeners.delete(listener); }; } };
const navigateBack = jest.fn();
function pressBack() { for (const listener of [...backListeners].reverse()) if (listener()) return; navigateBack(); }
function Harness({ owner = navigation }: { owner?: SheetFocusOwner }) {
  [visible, setOpen] = useBackOwnedSheetState(owner);
  return <SheetSurface visible={visible} title={uiLabel('Sort')} onClose={() => setOpen(false)}><div /></SheetSurface>;
}
function mount() { act(() => { tree = TestRenderer.create(<Harness />) as Renderer; }); }
beforeEach(() => {
  focused = true; backListeners.splice(0); blurListeners.clear(); navigateBack.mockClear();
  jest.spyOn(Keyboard, 'isVisible').mockReturnValue(false);
  jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_name, handler) => {
    const callback = () => handler() === true; backListeners.push(callback);
    return { remove: () => { const index = backListeners.indexOf(callback); if (index >= 0) backListeners.splice(index, 1); } };
  });
});
afterEach(() => { if (tree) act(() => tree!.unmount()); tree = undefined; jest.restoreAllMocks(); });

test('open owns Back synchronously before React/native commit, then cancellation cannot show a late Modal', () => {
  mount();
  act(() => {
    setOpen(true);
    expect(backListeners).toHaveLength(1);
    expect(tree!.root.findByType(Modal).props.visible).toBe(false);
    pressBack();
  });
  expect(visible).toBe(false); expect(tree!.root.findByType(Modal).props.visible).toBe(false);
  expect(backListeners).toHaveLength(0); expect(blurListeners.size).toBe(0); expect(navigateBack).not.toHaveBeenCalled();
});

test('keyboard-first Back retains the sheet, then a second Back closes it', () => {
  mount(); act(() => setOpen(true)); jest.mocked(Keyboard.isVisible).mockReturnValue(true);
  act(() => pressBack()); expect(Keyboard.dismiss).toHaveBeenCalledTimes(1); expect(visible).toBe(true);
  jest.mocked(Keyboard.isVisible).mockReturnValue(false); act(() => pressBack());
  expect(visible).toBe(false); expect(navigateBack).not.toHaveBeenCalled();
});

test('close/reopen in one batch owns a fresh generation and ignores old Back/blur callbacks', () => {
  mount(); act(() => setOpen(true)); const oldBack = backListeners[0], oldBlur = [...blurListeners][0];
  act(() => { setOpen(false); setOpen(true); });
  expect(visible).toBe(true); expect(tree!.root.findByType(Modal).props.visible).toBe(true);
  act(() => { expect(oldBack()).toBe(false); oldBlur(); });
  expect(visible).toBe(true); expect(backListeners).toHaveLength(1);
  act(() => pressBack()); expect(visible).toBe(false); expect(navigateBack).not.toHaveBeenCalled();
});

test('blur cancels the pending intent and an unfocused route cannot reopen or consume Back', () => {
  mount(); act(() => { setOpen(true); focused = false; [...blurListeners].forEach(listener => listener()); });
  expect(visible).toBe(false); expect(tree!.root.findByType(Modal).props.visible).toBe(false); expect(backListeners).toHaveLength(0);
  act(() => setOpen(true)); expect(visible).toBe(false); pressBack(); expect(navigateBack).toHaveBeenCalledTimes(1);
});

test('the live navigation owner rejects Back after focus changes even before a blur event', () => {
  mount(); act(() => setOpen(true)); focused = false; act(() => pressBack());
  expect(visible).toBe(false); expect(navigateBack).toHaveBeenCalledTimes(1); expect(backListeners).toHaveLength(0);
});

test('unmount removes all listeners and stale callbacks cannot reopen the sheet', () => {
  mount(); act(() => setOpen(true)); const staleBack = backListeners[0], staleOpen = setOpen;
  act(() => tree!.unmount()); tree = undefined;
  expect(backListeners).toHaveLength(0); expect(blurListeners.size).toBe(0);
  act(() => staleOpen(true)); expect(backListeners).toHaveLength(0); expect(staleBack()).toBe(false);
});

test('native Modal close is idempotent during one render and a renewed open accepts Back again', () => {
  mount(); act(() => setOpen(true)); const close = tree!.root.findByType(Modal).props.onRequestClose;
  act(() => { close(); close(); }); expect(visible).toBe(false); expect(backListeners).toHaveLength(0);
  act(() => setOpen(true)); act(() => tree!.root.findByType(Modal).props.onRequestClose());
  expect(visible).toBe(false); expect(navigateBack).not.toHaveBeenCalled();
});
