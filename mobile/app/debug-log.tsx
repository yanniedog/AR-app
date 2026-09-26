import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';

import { Screen } from '../src/components/Screen';
import { ProductTermsRuntimeCheck } from '../src/components/ProductTermsRuntimeCheck';
import { AppText, Button, Card, Row } from '../src/components/ui';
import {
  DEBUG_LOG_SHARE_FILE,
  debugLog,
  deleteDebugLogUploadAndReceipt,
  formatVersionedLogExport,
  loadDebugLogUploadReceipts,
  type DebugLogUploadReceipt,
} from '../src/lib/debugLog';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useTheme } from '../src/theme/ThemeProvider';
import { DebugLogUploadStatus } from '../src/components/DebugLogUploadStatus';
import {
  forgetDeletedDebugLogUpload,
  getDebugLogUploadSnapshot,
  isDebugLogUploadBusy,
  startDebugLogUpload,
  subscribeDebugLogUpload,
} from '../src/lib/debugLogSharing';

const RECEIPT_CHECK_FAILED_MESSAGE =
  'A previous public upload could not be checked. Public upload is unavailable for now; local Copy and Share still work.';
function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function DebugLogScreenInner() {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [text, setText] = useState(debugLog.getDisplayText());
  const [uploadReceipts, setUploadReceipts] = useState<DebugLogUploadReceipt[]>([]);
  const uploadState = useSyncExternalStore(
    subscribeDebugLogUpload, getDebugLogUploadSnapshot, getDebugLogUploadSnapshot,
  );
  const uploadBusy = isDebugLogUploadBusy();
  const visibleReceipts = uploadState.recoveryReceipt
    ? [uploadState.recoveryReceipt, ...uploadReceipts.filter((item) => item.url !== uploadState.recoveryReceipt?.url)]
    : uploadReceipts;
  const hasPublicUploads = visibleReceipts.length > 0;
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
    void loadDebugLogUploadReceipts()
      .then((receipts) => {
        if (active) { setUploadReceipts(receipts); setReceiptError(null); }
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
  }, [uploadState.phase]);

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
                hasPublicUploads
                  ? 'Local diagnostics were removed. Public uploads and their deletion access were retained.'
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
  }, [hasPublicUploads]);

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

  const runUpload = useCallback(async (acceptDuplicateRisk = false) => {
    if (busyRef.current || isDebugLogUploadBusy() || !receiptLoaded || receiptError) return;
    busyRef.current = 'upload';
    setBusy('upload');
    try {
      await startDebugLogUpload({
        sessionId: null,
        appVersion: Application.nativeApplicationVersion ?? 'unknown',
        buildVersion: Application.nativeBuildVersion ?? 'unknown',
      }, { acceptDuplicateRisk });
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }, [receiptError, receiptLoaded]);

  const onUpload = useCallback(() => {
    Alert.alert(
      'Upload full log?',
      'The log and complete audit report will be sent to paste.rs or paste.c-net.org. Anyone with the link can read it. After verification, the link is copied to your clipboard.' +
        (uploadState.mayHaveUploaded ? ' An earlier upload was not confirmed and may already exist without a deletion receipt. This creates another public copy.' : ''),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upload and copy link', onPress: () => void runUpload(uploadState.mayHaveUploaded) },
      ],
    );
  }, [runUpload, uploadState.mayHaveUploaded]);

  const onCopyUrl = useCallback(async (uploadReceipt: DebugLogUploadReceipt) => {
    if (!uploadReceipt.verified) return;
    try {
      if (await Clipboard.setStringAsync(uploadReceipt.url) === false) {
        throw new Error('Clipboard access was unavailable.');
      }
      Alert.alert('Copied', 'Paste URL copied — ready to paste.');
    } catch (err) {
      Alert.alert('Copy failed', String((err as Error)?.message ?? err));
    }
  }, []);

  const onDeleteUpload = useCallback((uploadReceipt: DebugLogUploadReceipt) => {
    if (busyRef.current || isDebugLogUploadBusy()) return;
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
                setUploadReceipts((receipts) => receipts.filter((item) => item.url !== uploadReceipt.url));
                forgetDeletedDebugLogUpload(uploadReceipt.url);
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
  }, []);

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
            temporary file afterward. Upload sends the full log to public hosting and copies the
            verified link.
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
              disabled={busy !== null || uploadBusy}
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
              title="Upload and copy link"
              icon="cloud-upload-outline"
              loading={busy === 'upload'}
              disabled={busy !== null || uploadBusy || clearFailed || !receiptLoaded || receiptError != null}
              onPress={onUpload}
            />
          </Row>
          {/* Upload status survives navigation and audit completion. */}
          <DebugLogUploadStatus />
        </View>
        <ScrollView
          ref={scrollRef}
          onContentSizeChange={() => setLogLayoutReady(true)}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: 32,
            gap: 12,
          }}
        >
          {visibleReceipts.map((uploadReceipt) => (
            <Card key={uploadReceipt.url} style={{ gap: 8 }}>
              <AppText variant="tiny" color="textMuted">
                Public upload ({uploadReceipt.provider}) · {new Date(uploadReceipt.createdAt).toLocaleString()}
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
                disabled={uploadBusy || !uploadReceipt.verified}
                onPress={() => void onCopyUrl(uploadReceipt)}
              />
              <Button
                title="Delete uploaded log"
                icon="trash-outline"
                variant="ghost"
                loading={busy === 'delete'}
                disabled={busy !== null || uploadBusy}
                onPress={() => onDeleteUpload(uploadReceipt)}
              />
            </Card>
          ))}
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
          <ProductTermsRuntimeCheck />
        </ScrollView>
      </Screen>
  );
}

export default function DebugLogScreen() {
  return <DebugLogScreenInner />;
}
