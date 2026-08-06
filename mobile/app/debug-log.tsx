import * as Application from 'expo-application';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Share, View } from 'react-native';

import { Screen } from '../src/components/Screen';
import { AppText, Button, Card, Row } from '../src/components/ui';
import {
  debugLog,
  deleteDebugLogUpload,
  formatLogUploadBody,
  redactSecrets,
  uploadDebugLog,
} from '../src/lib/debugLog';
import { useTheme } from '../src/theme/ThemeProvider';

export default function DebugLogScreen() {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const retryUploadRef = useRef<() => void>(() => {});
  const [text, setText] = useState(debugLog.getDisplayText());
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [uploadProvider, setUploadProvider] = useState<string | null>(null);
  const [uploadDeleteKey, setUploadDeleteKey] = useState<string | null>(null);
  const [busy, setBusy] = useState<'copy' | 'share' | 'upload' | 'delete' | 'path' | null>(null);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const uploadUrlRef = useRef(uploadUrl);
  uploadUrlRef.current = uploadUrl;
  const logPathHint = debugLog.getAndroidLogPathHint();

  useEffect(() => {
    return debugLog.subscribe(() => setText(debugLog.getDisplayText()));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, [text]);

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
            debugLog.clear();
            setUploadUrl(null);
            setUploadProvider(null);
            setUploadDeleteKey(null);
          },
        },
      ],
    );
  }, []);

  const onCopyPath = useCallback(async () => {
    setBusy('path');
    try {
      await Clipboard.setStringAsync(logPathHint);
      Alert.alert('Copied', 'Log file path copied.');
    } catch (err) {
      Alert.alert('Copy failed', String((err as Error)?.message ?? err));
    } finally {
      setBusy(null);
    }
  }, [logPathHint]);

  const onCopy = useCallback(async () => {
    setBusy('copy');
    try {
      await Clipboard.setStringAsync(redactSecrets(debugLog.getText()));
      Alert.alert('Copied', `${debugLog.getEntries().length} lines copied.`);
    } catch (err) {
      Alert.alert('Copy failed', String((err as Error)?.message ?? err));
    } finally {
      setBusy(null);
    }
  }, []);

  const onShare = useCallback(async () => {
    setBusy('share');
    try {
      const path = FileSystem.cacheDirectory
        ? `${FileSystem.cacheDirectory}ar-debug-log-share.txt`
        : null;
      if (path && await Sharing.isAvailableAsync()) {
        // The screen renders a small tail for responsiveness; export the full
        // bounded in-memory log on explicit user action.
        await FileSystem.writeAsStringAsync(path, redactSecrets(debugLog.getText()));
        await Sharing.shareAsync(path, {
          mimeType: 'text/plain',
          dialogTitle: 'Share debug log',
          UTI: 'public.plain-text',
        });
      } else {
        await Share.share({ message: redactSecrets(debugLog.getText()), title: 'ar-local.log' });
      }
    } catch (err) {
      Alert.alert('Share failed', String((err as Error)?.message ?? err));
    } finally {
      setBusy(null);
    }
  }, []);

  const runUpload = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = 'upload';
    setBusy('upload');
    try {
      const completeLog = await debugLog.readCompleteText();
      const body = formatLogUploadBody(completeLog, {
        app: Application.nativeApplicationVersion ?? 'unknown',
        build: Application.nativeBuildVersion ?? 'unknown',
      });
      const result = await uploadDebugLog(body);
      const { url, provider, deleteKey } = result;
      if (result.truncated || result.clientTruncated) {
        throw new Error('The upload service did not accept the complete log.');
      }
      setUploadUrl(url);
      setUploadProvider(provider);
      setUploadDeleteKey(deleteKey ?? null);
      let copied = true;
      try {
        await Clipboard.setStringAsync(url);
      } catch {
        copied = false;
      }
      Alert.alert('Uploaded', copied ? 'Full-log link copied.' : 'Full-log link is shown below.');
    } catch (err) {
      Alert.alert(
        'Upload unavailable',
        String((err as Error)?.message ?? err),
        [
          {
            text: 'Retry',
            onPress: () => retryUploadRef.current(),
          },
          {
            text: 'Share',
            onPress: () => {
              void onShare();
            },
          },
          {
            text: 'Copy log',
            onPress: () => {
              void onCopy();
            },
          },
        ],
      );
    } finally {
      busyRef.current = null;
      setBusy(null);
    }
  }, [onCopy, onShare]);
  retryUploadRef.current = () => {
    void runUpload();
  };

  const onUpload = useCallback(() => {
    void runUpload();
  }, [runUpload]);

  const onCopyUrl = useCallback(async () => {
    if (!uploadUrl) return;
    try {
      await Clipboard.setStringAsync(uploadUrl);
      Alert.alert('Copied', 'Paste URL copied — ready to paste.');
    } catch (err) {
      Alert.alert('Copy failed', String((err as Error)?.message ?? err));
    }
  }, [uploadUrl]);

  const onDeleteUpload = useCallback(() => {
    if (busyRef.current || !uploadUrl || !uploadDeleteKey) return;
    Alert.alert(
      'Delete uploaded log?',
      'Permanently removes this public backup-host copy. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const deletingUrl = uploadUrl;
            if (busyRef.current) return;
            busyRef.current = 'delete';
            setBusy('delete');
            void deleteDebugLogUpload(deletingUrl, uploadDeleteKey)
              .then(() => {
                if (uploadUrlRef.current !== deletingUrl) return;
                setUploadUrl(null);
                setUploadProvider(null);
                setUploadDeleteKey(null);
                Alert.alert('Uploaded log deleted');
              })
              .catch((err) => {
                Alert.alert('Delete failed', String((err as Error)?.message ?? err));
              })
              .finally(() => {
                busyRef.current = null;
                setBusy(null);
              });
          },
        },
      ],
    );
  }, [uploadDeleteKey, uploadUrl]);

  return (
    <Screen style={{ flex: 1 }}>
        <View style={{ padding: 16, paddingBottom: 8, gap: 12 }}>
          <AppText variant="tiny" color="textFaint">
            May include device/network info. Known credential and account identifier patterns are
            redacted; review before sharing.
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
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Button title="Clear" icon="trash-outline" variant="ghost" onPress={onClear} />
            <Button
              title="Copy"
              icon="copy-outline"
              variant="secondary"
              loading={busy === 'copy'}
              onPress={() => void onCopy()}
            />
            <Button
              title="Share"
              icon="share-outline"
              variant="secondary"
              loading={busy === 'share'}
              onPress={() => void onShare()}
            />
            <Button
              title="Upload"
              icon="cloud-upload-outline"
              loading={busy === 'upload'}
              disabled={busy !== null}
              onPress={onUpload}
            />
          </Row>
          {uploadUrl ? (
            <Card style={{ gap: 8 }}>
              <AppText variant="tiny" color="textMuted">
                Upload link{uploadProvider ? ` (${uploadProvider})` : ''} — long-press to select
              </AppText>
              <AppText
                variant="small"
                selectable
                style={{ fontFamily: 'monospace' }}
              >
                {uploadUrl}
              </AppText>
              <Button
                title="Copy link"
                icon="link-outline"
                onPress={() => void onCopyUrl()}
              />
              {uploadDeleteKey ? (
                <Button
                  title="Delete uploaded log"
                  icon="trash-outline"
                  variant="ghost"
                  loading={busy === 'delete'}
                  disabled={busy === 'delete'}
                  onPress={onDeleteUpload}
                />
              ) : null}
            </Card>
          ) : null}
        </View>
        <ScrollView
          ref={scrollRef}
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
