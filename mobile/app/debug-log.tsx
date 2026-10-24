import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { Screen } from '../src/components/Screen';
import { ProductTermsRuntimeCheck } from '../src/components/ProductTermsRuntimeCheck';
import { AppText, Button, Card, Row } from '../src/components/ui';
import {
  DEBUG_LOG_SHARE_FILE,
  debugLog,
  deleteDebugLogUploadAndReceipt,
  loadDebugLogUploadReceipts,
  type DebugLogUploadReceipt,
} from '../src/lib/debugLog';
import { usePerformanceAuditSurface } from '../src/hooks/usePerformanceAuditReadiness';
import { useTheme } from '../src/theme/ThemeProvider';
import { DebugLogUploadStatus } from '../src/components/DebugLogUploadStatus';
import { DebugEvidenceText } from '../src/components/DebugEvidenceText';
import { readVersionedDebugEvidence, shareVersionedDebugEvidence } from '../src/lib/debugEvidence';
import { InfoRow } from '../src/components/settings/settingsUi';
import { uiDate, uiIdentifier, uiJoin, uiLabel } from '../src/lib/uiCopy';
import {
  forgetDeletedDebugLogUpload,
  getDebugLogUploadSnapshot,
  isDebugLogUploadBusy,
  startDebugLogUpload,
  subscribeDebugLogUpload,
} from '../src/lib/debugLogSharing';

const RECEIPT_CHECK_FAILED_MESSAGE =
  uiLabel('Upload receipt unverified');
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
  const readVersionedExport = readVersionedDebugEvidence;

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
      uiLabel('Clear debug log?'),
      uiJoin('Local file removed', ' · ', 'Public uploads retained'),
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
                uiLabel('Debug log cleared'),
                hasPublicUploads
                  ? uiJoin('Local file removed', ' · ', 'Public uploads retained')
                  : uiLabel('Local file removed'),
              );
            }).catch(() => {
              setClearFailed(true);
              Alert.alert(uiLabel('Clear incomplete'), uiLabel('Private diagnostics retained'));
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
      Alert.alert(uiLabel('Copied'));
    } catch {
      Alert.alert(uiLabel('Copy failed'));
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
      Alert.alert(uiLabel('Copied'));
    } catch {
      Alert.alert(uiLabel('Copy failed'));
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }, [readVersionedExport]);

  const onShare = useCallback(async (fullEvidence = false) => {
    if (busyRef.current) return;
    busyRef.current = 'share';
    setBusy('share');
    let wroteShareFile = false;
    try {
      const path = FileSystem.cacheDirectory ? DEBUG_LOG_SHARE_FILE : null;
      if (path && await Sharing.isAvailableAsync()) {
        const body = await readVersionedExport(fullEvidence);
        // The screen renders a small tail for responsiveness; explicit export
        // reads the complete flushed file and durable latest audit instead.
        await FileSystem.writeAsStringAsync(path, body);
        wroteShareFile = true;
        await Sharing.shareAsync(path, {
          mimeType: 'text/plain',
          dialogTitle: uiJoin('Share',' ','Debug log'),
          UTI: 'public.plain-text',
        });
      } else {
        await shareVersionedDebugEvidence(fullEvidence);
      }
    } catch {
      Alert.alert(uiLabel('Share failed'));
    } finally {
      if (wroteShareFile) {
        try {
          await FileSystem.deleteAsync(DEBUG_LOG_SHARE_FILE, { idempotent: true });
        } catch {
          setClearFailed(true);
          Alert.alert(
            uiLabel('Temporary share file retained'),
            uiJoin('Private diagnostics retained', ' · ', 'Export blocked'),
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
      uiLabel('Upload diagnostic log?'),
      uiJoin('Public hosting', ': ', uiIdentifier('paste.rs'), ' / ', uiIdentifier('paste.c-net.org'), ' · ',
        'Private diagnostics', ' · ', 'Clipboard',
        uploadState.mayHaveUploaded ? uiJoin(' · ', 'Duplicate public copy possible') : null),
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Upload and copy link', onPress: () => void runUpload(uploadState.mayHaveUploaded) },
      ],
    );
  }, [runUpload, uploadState.mayHaveUploaded]);

  const onCopyUrl = useCallback(async (uploadReceipt: DebugLogUploadReceipt) => {
    if (!uploadReceipt.verified) return;
    try {
      if (await Clipboard.setStringAsync(uploadReceipt.shareUrl ?? uploadReceipt.url) === false) {
        throw new Error('Clipboard access was unavailable.');
      }
      Alert.alert(uiLabel('Copied'));
    } catch {
      Alert.alert(uiLabel('Copy failed'));
    }
  }, []);

  const onDeleteUpload = useCallback((uploadReceipt: DebugLogUploadReceipt) => {
    if (busyRef.current || isDebugLogUploadBusy()) return;
    Alert.alert(
      uiLabel('Delete uploaded log?'),
      uiJoin('Public copy', ' · ', 'Deletion irreversible'),
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
                Alert.alert(uiLabel('Uploaded log deleted'));
              })
              .catch((err) => {
                debugLog.warn(
                  'debugLogUploadReceipt',
                  `delete was not confirmed: ${errorDetail(err)}`,
                );
                Alert.alert(
                  uiLabel('Delete not confirmed'),
                  uiJoin('Public copy', ' · ', 'Unknown'),
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
          <InfoRow label="Private diagnostics" value="Device / network / rate / product / receipt / error" />
          <InfoRow label="Privacy" value="Redaction unguaranteed" />
          <Card style={{ gap: 8 }}>
            <AppText variant="tiny" color="textMuted">
              {uiLabel('Local file')}
            </AppText>
            <AppText variant="small" selectable style={{ fontFamily: 'monospace' }}>
              {uiIdentifier(logPathHint)}
            </AppText>
            <Button
              title="Copy path"
              icon="folder-outline"
              variant="ghost"
              loading={busy === 'path'}
              onPress={() => void onCopyPath()}
            />
          </Card>
          <InfoRow label="Copy" value="Clipboard" />
          <InfoRow label="Share" value="Operating-system share sheet" />
          <InfoRow label="Upload" value="Public hosting" />
          <InfoRow label="Full evidence" value="This device" />
          {clearFailed ? (
            <AppText accessibilityRole="alert" variant="tiny" color="danger">
              {uiJoin('Clear incomplete', ' · ', 'Export blocked')}
            </AppText>
          ) : null}
          {receiptError ? (
            <AppText accessibilityRole="alert" variant="tiny" color="danger">
              {uiLabel('Upload receipt unverified')}
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
              title="Share full evidence"
              icon="document-text-outline"
              variant="ghost"
              disabled={busy !== null || clearFailed}
              onPress={() => void onShare(true)}
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
                {uiJoin('Public hosting', ' · ', uiIdentifier(uploadReceipt.provider), ' · ', uiDate(uploadReceipt.createdAt))}
              </AppText>
              <AppText
                variant="small"
                selectable
                style={{ fontFamily: 'monospace' }}
              >
                {uiIdentifier(uploadReceipt.shareUrl ?? uploadReceipt.url)}
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
            <DebugEvidenceText />
          </View>
          <ProductTermsRuntimeCheck />
        </ScrollView>
      </Screen>
  );
}

export default function DebugLogScreen() {
  return <DebugLogScreenInner />;
}
