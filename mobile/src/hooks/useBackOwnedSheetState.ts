import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { BackHandler, Keyboard } from 'react-native';

export interface SheetFocusOwner {
  isFocused(): boolean;
  addListener(event: 'blur', listener: () => void): () => void;
}

/** Own Back at the open intent, before React commits a native Modal. */
export function useBackOwnedSheetState(navigation: SheetFocusOwner): [boolean, Dispatch<SetStateAction<boolean>>] {
  const [state, setState] = useState({ visible: false });
  const intended = useRef(false), alive = useRef(true), generation = useRef(0);
  const navigationRef = useRef(navigation), previousNavigation = useRef(navigation);
  navigationRef.current = navigation;
  const backSubscription = useRef<{ remove(): void } | null>(null);
  const stopBlur = useRef<(() => void) | null>(null);
  const release = useCallback(() => {
    backSubscription.current?.remove(); backSubscription.current = null;
    stopBlur.current?.(); stopBlur.current = null;
  }, []);
  const setVisible = useCallback<Dispatch<SetStateAction<boolean>>>(value => {
    if (!alive.current) return;
    const next = typeof value === 'function' ? value(intended.current) : value;
    if ((next && !navigationRef.current.isFocused()) || next === intended.current) return;
    intended.current = next;
    const intentGeneration = ++generation.current;
    release();
    if (next) {
      backSubscription.current = BackHandler.addEventListener('hardwareBackPress', () => {
        if (!alive.current || generation.current !== intentGeneration || !intended.current) return false;
        if (!navigationRef.current.isFocused()) { setVisible(false); return false; }
        if (Keyboard.isVisible()) Keyboard.dismiss();
        else setVisible(false);
        return true;
      });
      stopBlur.current = navigationRef.current.addListener('blur', () => {
        if (generation.current === intentGeneration) setVisible(false);
      });
    }
    // A close/reopen in one batch still commits the renewed intent.
    setState({ visible: next });
  }, [release]);
  useEffect(() => {
    if (previousNavigation.current !== navigation) {
      previousNavigation.current = navigation;
      setVisible(false);
    }
  }, [navigation, setVisible]);
  const stopOwner = useCallback(() => {
    alive.current = false; intended.current = false; ++generation.current; release();
  }, [release]);
  useEffect(() => {
    alive.current = true;
    return stopOwner;
  }, [stopOwner]);
  return [state.visible, setVisible];
}
