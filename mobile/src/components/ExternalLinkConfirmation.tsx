import React, { createContext, type ReactNode, useCallback, useContext, useState } from 'react';
import { Linking, Modal, Pressable, View } from 'react-native';

import {
  trustedExternalUrl,
  type TrustedExternalUrlRequest,
  type TrustedExternalUrlResult,
} from '../lib/trustedExternalUrl';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button, Row } from './ui';

interface TrustedExternalUrlContextValue {
  requestExternalUrl: (request: TrustedExternalUrlRequest) => void;
}

const TrustedExternalUrlContext = createContext<TrustedExternalUrlContextValue | null>(null);

type DialogState =
  | { kind: 'confirm'; request: TrustedExternalUrlRequest; trusted: Extract<TrustedExternalUrlResult, { ok: true }> }
  | { kind: 'error'; message: string };

export function ExternalLinkConfirmation({
  state,
  opening,
  onClose,
  onConfirm,
}: {
  state: DialogState | null;
  opening: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const theme = useTheme();
  const isError = state?.kind === 'error';
  return (
    <Modal
      visible={state != null}
      transparent
      animationType="fade"
      onRequestClose={opening ? undefined : onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          testID="external-link-backdrop"
          onPress={opening ? undefined : onClose}
          accessibilityLabel="Stay in AustralianRates"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: 'rgba(0,0,0,0.58)',
          }}
        />
        <View
          testID="external-link-confirmation"
          accessibilityViewIsModal
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 22,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: 20,
            paddingBottom: 28,
          }}
        >
          <AppText variant="h3">
            {isError ? 'Link unavailable' : 'Open external website?'}
          </AppText>
          {state?.kind === 'confirm' ? (
            <>
              <AppText variant="small" color="textMuted" style={{ marginTop: 8, lineHeight: 20 }}>
                {state.trusted.label} will open outside AustralianRates.
              </AppText>
              <AppText
                testID="external-link-host"
                variant="body"
                weight="700"
                selectable
                style={{ marginTop: 12 }}
              >
                {state.trusted.host}
              </AppText>
              <AppText variant="tiny" color="textFaint" style={{ marginTop: 6, lineHeight: 17 }}>
                Check the destination before continuing. The external site has its own privacy and security practices.
              </AppText>
            </>
          ) : state?.kind === 'error' ? (
            <>
              <AppText variant="small" color="textMuted" style={{ marginTop: 8, lineHeight: 20 }}>
                {state.message}
              </AppText>
              <AppText variant="tiny" color="textFaint" style={{ marginTop: 6, lineHeight: 17 }}>
                Stay in the app or choose another official source.
              </AppText>
            </>
          ) : null}
          <Row gap={12} style={{ marginTop: 20 }}>
            {state?.kind === 'confirm' ? (
              <>
                <Button
                  title="Cancel"
                  variant="secondary"
                  style={{ flex: 1 }}
                  disabled={opening}
                  onPress={onClose}
                />
                <Button
                  title="Continue"
                  style={{ flex: 1 }}
                  loading={opening}
                  onPress={onConfirm}
                />
              </>
            ) : (
              <Button title="Back to app" style={{ flex: 1 }} onPress={onClose} />
            )}
          </Row>
        </View>
      </View>
    </Modal>
  );
}

export function TrustedExternalUrlProvider({
  children,
  openUrl = Linking.openURL,
}: {
  children: ReactNode;
  openUrl?: (url: string) => Promise<unknown>;
}) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [opening, setOpening] = useState(false);

  const requestExternalUrl = useCallback((request: TrustedExternalUrlRequest) => {
    const trusted = trustedExternalUrl(request);
    setOpening(false);
    setDialog(
      trusted.ok
        ? { kind: 'confirm', request, trusted }
        : { kind: 'error', message: trusted.message },
    );
  }, []);

  const close = useCallback(() => {
    if (opening) return;
    setDialog(null);
  }, [opening]);

  const confirm = useCallback(async () => {
    if (opening || dialog?.kind !== 'confirm') return;
    // Revalidate at the point of use so no mutable dialog state can bypass the
    // policy that was shown to the user.
    const trusted = trustedExternalUrl(dialog.request);
    if (!trusted.ok) {
      setDialog({ kind: 'error', message: trusted.message });
      return;
    }
    setOpening(true);
    try {
      await openUrl(trusted.url);
      setDialog(null);
    } catch {
      setDialog({
        kind: 'error',
        message: 'The approved website could not be opened on this device.',
      });
    } finally {
      setOpening(false);
    }
  }, [dialog, openUrl, opening]);

  return (
    <TrustedExternalUrlContext.Provider value={{ requestExternalUrl }}>
      {children}
      <ExternalLinkConfirmation
        state={dialog}
        opening={opening}
        onClose={close}
        onConfirm={() => void confirm()}
      />
    </TrustedExternalUrlContext.Provider>
  );
}

export function useTrustedExternalUrl(): TrustedExternalUrlContextValue {
  const value = useContext(TrustedExternalUrlContext);
  if (!value) {
    throw new Error('useTrustedExternalUrl must be used within TrustedExternalUrlProvider');
  }
  return value;
}
