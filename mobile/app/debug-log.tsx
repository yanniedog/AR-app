import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';

import { Screen } from '../src/components/Screen';
import { AppText, Button, Card, Row } from '../src/components/ui';
import {
  DEBUG_LOG_SHARE_FILE,
  debugLog,
  deleteDebugLogUpload,
  deleteDebugLogUploadAndReceipt,
  formatVersionedLogExport,
  loadDebugLogUploadReceipt,
  saveDebugLogUploadReceipt,
  uploadDebugLog,
  type DebugLogUploadReceipt,
} from '../src/lib/debugLog';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useTheme } from '../src/theme/ThemeProvider';

const RECEIPT_CHECK_FAILED_MESSAGE =
  'A previous public upload could not be checked. Public upload is unavailable for now; local Copy and Share still work.';
const RECEIPT_STORAGE_FAILED_MESSAGE =
  'The public copy was removed because its deletion receipt could not be secured. Public upload stays off; local Copy and Share still work.';
const RECEIPT_DELETE_UNCONFIRMED_MESSAGE =
  'The deletion receipt could not be secured, and removal of the public copy was not confirmed. Keep this screen open and use Delete uploaded log.';

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function DebugLogScreenInner() {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [text, setText] = useState(debugLog.getDisplayText());
  const [uploadReceipt, setUploadReceipt] = useState<DebugLogUploadReceipt | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [receiptLoaded, setReceiptLoaded] = useState(false);
  const [clearFailed, setClearFailed] = useState(false);
  const [busy, setBusy] = useState<'clear' | 'copy' | 'share' | 'upload' | 'delete' | 'path' | null>(null);
  const [logLayoutReady, setLogLayoutReady] = useState(false);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const logPathHint = debugLog.getAndroidLogPathHint();
  const readVersionedExport = useCallback(async () => {
    const completeLog = await debugLog.readCompleteText();
    return formatVersionedLogExport(
      completeLog,
      Application.nativeApplicationVersion ?? 'unknown',
      Application.nativeBuildVersion ?? 'unknown',
    );
  }, []);

  useEffect(() => {
    return debugLog.subscribe(() => setText(debugLog.getDisplayText()));
  }, []);

  useEffect(() => {
    let active = true;
    void loadDebugLogUploadReceipt()
      .then((receipt) => {
        if (active) setUploadReceipt(receipt);
      })
      .catch((error) => {
        debugLog.warn('debugLogUploadReceipt', `read failed: ${errorDetail(error)}`);
        if (active) setReceiptError(RECEIPT_CHECK_FAILED_MESSAGE);
      })
      .finally(() => {
        if (active) setReceiptLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const scrollToLogEnd = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, []);

  useEffect(() => {
    scrollToLogEnd();
  }, [scrollToLogEnd, text]);

  const logEntryCount = text ? text.split('\n').length : 0;
  const auditActions = useMemo(() => ({
    'debug-log.open': () => undefined,
    'debug-log.scroll.end': scrollToLogEnd,
  }), [scrollToLogEnd]);
  usePerformanceAuditSurface({
    id: 'debug-log.entries',
    routeKey: '/debug-log',
    renderRevision: `${logEntryCount}:${text.length}`,
    actions: auditActions,
    probes: [
      {
        id: 'debug-log.buffer',
        kind: 'data',
        status: 'ready',
        expectedCount: logEntryCount,
        actualCount: logEntryCount,
      },
      {
        id: 'debug-log.list',
        kind: 'list',
        status: logLayoutReady ? 'ready' : 'pending',
        expectedCount: logEntryCount,
        actualCount: logEntryCount,
      },
      {
        id: 'debug-log.layout',
        kind: 'layout',
        status: logLayoutReady ? 'ready' : 'pending',
        layoutMeasured: logLayoutReady,
      },
    ],
  });

  const onClear = useCallback(() => {
    Alert.alert(
      'Clear debug log?',
      'Clears the in-app buffer and deletes the on-disk log file.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            if (busyRef.current) return;
            busyRef.current = 'clear';
            setBusy('clear');
            setClearFailed(false);
            void debugLog.clear().then(() => {
              Alert.alert(
                'Debug log cleared',
                uploadReceipt
                  ? 'Local diagnostics were removed. The public-upload deletion receipt was retained.'
                  : 'Local diagnostics were removed and absence was verified.',
              );
            }).catch((error) => {
              setClearFailed(true);
              Alert.alert('Clear incomplete', error instanceof Error ? error.message : String(error));
            }).finally(() => {
              busyRef.current = null;
              setBusy(null);
            });
          },
        },
      ],
    );
  }, [uploadReceipt]);

  const onCopyPath = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = 'path';
    setBusy('path');
    try {
      await Clipboard.setStringAsync(logPathHint);
      Alert.alert('Copied', 'Log file path copied.');
    } catch (err) {
      Alert.alert('Copy failed', String((err as Error)?.message ?? err));
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }, [logPathHint]);

  const onCopy = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = 'copy';
    setBusy('copy');
    try {
      const body = await readVersionedExport();
      await Clipboard.setStringAsync(body);
      Alert.alert('Copied', 'Complete on-disk log and latest performance audit copied.');
    } catch (err) {
      Alert.alert('Copy failed', String((err as Error)?.message ?? err));
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }, [readVersionedExport]);

  const onShare = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = 'share';
    setBusy('share');
    let wroteShareFile = false;
    try {
      const body = await readVersionedExport();
      const path = FileSystem.cacheDirectory ? DEBUG_LOG_SHARE_FILE : null;
      if (path && await Sharing.isAvailableAsync()) {
        // The screen renders a small tail for responsiveness; explicit export
        // reads the complete flushed file and durable latest audit instead.
        await FileSystem.writeAsStringAsync(path, body);
        wroteShareFile = true;
        await Sharing.shareAsync(path, {
          mimeType: 'text/plain',
          dialogTitle: 'Share debug log',
          UTI: 'public.plain-text',
        });
      } else {
        await Share.share({ message: body, title: 'ar-local.log' });
      }
    } catch (err) {
      Alert.alert('Share failed', String((err as Error)?.message ?? err));
    } finally {
      if (wroteShareFile) {
        try {
          await FileSystem.deleteAsync(DEBUG_LOG_SHARE_FILE, { idempotent: true });
        } catch (cleanupError) {
          setClearFailed(true);
          Alert.alert(
            'Temporary share file retained',
            `Private diagnostics could not be removed from the share cache. ` +
            `Use Clear before exporting again. ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`,
          );
        }
      }
      busyRef.current = null;
      setBusy(null);
    }
  }, [readVersionedExport]);

  const runUpload = useCallback(async () => {
    if (busyRef.current || !receiptLoaded || uploadReceipt || receiptError) return;
    busyRef.current = 'upload';
    setBusy('upload');
    try {
      const body = await readVersionedExport();
      const result = await uploadDebugLog(body);
      const { url, provider, deleteKey } = result;
      if (result.truncated || result.clientTruncated) {
        throw new Error('The upload service did not accept the complete log.');
      }
      try {
        const receipt = await saveDebugLogUploadReceipt({ url, provider, deleteKey });
        setUploadReceipt(receipt);
        setReceiptError(null);
      } catch (receiptFailure) {
        debugLog.warn(
          'debugLogUploadReceipt',
          `secure write failed: ${errorDetail(receiptFailure)}`,
        );
        try {
          await deleteDebugLogUpload(url, deleteKey);
        } catch (cleanupFailure) {
          debugLog.warn(
            'debugLogUploadReceipt',
            `public-copy cleanup was not confirmed: ${errorDetail(cleanupFailure)}`,
          );
          setUploadReceipt({
            schemaVersion: 1,
            url,
            provider,
            ...(deleteKey ? { deleteKey } : {}),
            createdAt: new Date().toISOString(),
          });
          setReceiptError(RECEIPT_DELETE_UNCONFIRMED_MESSAGE);
          throw new Error(RECEIPT_DELETE_UNCONFIRMED_MESSAGE);
        }
        setReceiptError(RECEIPT_STORAGE_FAILED_MESSAGE);
        throw new Error(RECEIPT_STORAGE_FAILED_MESSAGE);
      }
      Alert.alert(
        'Uploaded',
        `${provider} accepted the complete log. ` +
        'The link was not copied automatically. Its deletion receipt is secured on this device.',
      );
    } catch (err) {
      Alert.alert(
        'Upload unavailable',
        String((err as Error)?.message ?? err),
        [{
            text: 'Share',
            onPress: () => {
              void onShare();
            },
          }, {
            text: 'Copy log',
            onPress: () => {
              void onCopy();
            },
          }],
      );
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }, [onCopy, onShare, readVersionedExport, receiptError, receiptLoaded, uploadReceipt]);

  const onUpload = useCallback(() => {
    if (!receiptLoaded) {
      Alert.alert('Checking previous upload', 'Wait until the saved deletion receipt has been checked.');
      return;
    }
    if (receiptError) {
      Alert.alert(
        'Upload receipt unavailable',
        'The previous public-upload state could not be verified. Public upload stays blocked to avoid losing a deletion receipt.',
      );
      return;
    }
    if (uploadReceipt) {
      Alert.alert('Delete the existing public copy first', 'Only one deletion receipt can be active.');
      return;
    }
    Alert.alert(
      'Open expert public-upload flow?',
      'This is not the deidentified audit report. The raw debug log can contain private device, network, rate, product, receipt and error details even after pattern redaction. Prefer OS Share.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Review risk',
          style: 'destructive',
          onPress: () => Alert.alert(
            'Upload private log now?',
            'The complete raw log will be sent to paste.rs or paste.c-net.org and anyone with the link can read it. The app will securely retain a deletion receipt, but a lost network response can leave an unknown copy that cannot be recovered.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Upload publicly', style: 'destructive', onPress: () => void runUpload() },
            ],
          ),
        },
      ],
    );
  }, [receiptError, receiptLoaded, runUpload, uploadReceipt]);

  const onCopyUrl = useCallback(async () => {
    if (!uploadReceipt) return;
    try {
      await Clipboard.setStringAsync(uploadReceipt.url);
      Alert.alert('Copied', 'Paste URL copied — ready to paste.');
    } catch (err) {
      Alert.alert('Copy failed', String((err as Error)?.message ?? err));
    }
  }, [uploadReceipt]);

  const onDeleteUpload = useCallback(() => {
    if (busyRef.current || !uploadReceipt) return;
    Alert.alert(
      'Delete uploaded log?',
      'Permanently removes this public host copy. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (busyRef.current) return;
            busyRef.current = 'delete';
            setBusy('delete');
            void deleteDebugLogUploadAndReceipt(uploadReceipt)
              .then(() => {
                setUploadReceipt(null);
                setReceiptError(null);
                Alert.alert('Uploaded log deleted');
              })
              .catch((err) => {
                debugLog.warn(
                  'debugLogUploadReceipt',
                  `delete was not confirmed: ${errorDetail(err)}`,
                );
                Alert.alert(
                  'Delete not confirmed',
                  'The public copy or its local deletion receipt could not be fully removed. Try again while this screen remains open.',
                );
              })
              .finally(() => {
                busyRef.current = null;
                setBusy(null);
              });
          },
        },
      ],
    );
  }, [uploadReceipt]);

  return (
    <Screen style={{ flex: 1 }}>
        <View style={{ padding: 16, paddingBottom: 8, gap: 12 }}>
          <AppText variant="tiny" color="textFaint">
            Raw logs can include private device, network, rate, product, receipt and error details.
            Pattern redaction is not a privacy guarantee. Review before any export.
          </AppText>
          <Card style={{ gap: 8 }}>
            <AppText variant="tiny" color="textMuted">
              On-disk log (Android scoped storage)
            </AppText>
            <AppText variant="small" selectable style={{ fontFamily: 'monospace' }}>
              {logPathHint}
            </AppText>
            <Button
              title="Copy path"
              icon="folder-outline"
              variant="ghost"
              loading={busy === 'path'}
              onPress={() => void onCopyPath()}
            />
          </Card>
          <AppText variant="tiny" color="textMuted">
            Copy stays on this device. Share uses the operating-system share sheet and removes its
            temporary file afterward. Public hosting is a separate two-confirmation expert flow.
          </AppText>
          {clearFailed ? (
            <AppText accessibilityRole="alert" variant="tiny" color="danger">
              Clear was incomplete. Copy, Share and Upload stay blocked until Clear succeeds.
            </AppText>
          ) : null}
          {receiptError ? (
            <AppText accessibilityRole="alert" variant="tiny" color="danger">
              {receiptError}
            </AppText>
          ) : null}
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Button
              title="Clear"
              icon="trash-outline"
              variant="ghost"
              loading={busy === 'clear'}
              disabled={busy !== null}
              onPress={onClear}
            />
            <Button
              title="Copy"
              icon="copy-outline"
              variant="secondary"
              loading={busy === 'copy'}
              disabled={busy !== null || clearFailed}
              onPress={() => void onCopy()}
            />
            <Button
              title="Share"
              icon="share-outline"
              variant="secondary"
              loading={busy === 'share'}
              disabled={busy !== null || clearFailed}
              onPress={() => void onShare()}
            />
            <Button
              title="Expert public upload"
              icon="cloud-upload-outline"
              loading={busy === 'upload'}
              disabled={busy !== null || clearFailed || !receiptLoaded || receiptError != null || uploadReceipt != null}
              onPress={onUpload}
            />
          </Row>
          {uploadReceipt ? (
            <Card style={{ gap: 8 }}>
              <AppText variant="tiny" color="textMuted">
                Public upload ({uploadReceipt.provider}) — deletion receipt secured on this device
              </AppText>
              <AppText
                variant="small"
                selectable
                style={{ fontFamily: 'monospace' }}
              >
                {uploadReceipt.url}
              </AppText>
              <Button
                title="Copy link"
                icon="link-outline"
                onPress={() => void onCopyUrl()}
              />
              <Button
                title="Delete uploaded log"
                icon="trash-outline"
                variant="ghost"
                loading={busy === 'delete'}
                disabled={busy === 'delete'}
                onPress={onDeleteUpload}
              />
            </Card>
          ) : null}
        </View>
        <ScrollView
          ref={scrollRef}
          onContentSizeChange={() => setLogLayoutReady(true)}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 32,
          }}
        >
          <View
            style={{
              backgroundColor: theme.dark ? theme.colors.surface : theme.colors.chip,
              borderRadius: theme.radius.md,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: 12,
              minHeight: 200,
            }}
          >
            <AppText
              variant="tiny"
              selectable
              style={{
                fontFamily: 'monospace',
                lineHeight: 16,
                color: theme.colors.text,
              }}
            >
              {text || '(empty — use the app; logs appear here)'}
            </AppText>
          </View>
        </ScrollView>
      </Screen>
  );
}

export default function DebugLogScreen() {
  return <DebugLogScreenInner />;
}
