import * as Device from 'expo-device';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import {
  APK_ARM_MANIFEST_URL,
  APK_ARM_RELEASE_TAG,
  APK_MANIFEST_URL,
  APK_RELEASE_TAG,
  PLAY_STORE_URL,
  REPO,
  SELF_UPDATE_ENABLED,
} from '../config';
import {
  apkManifestUrlsForDevice,
  fetchBestCompatibleApkManifest,
} from '../lib/appUpdateLogic';
import { logSwallowedError } from '../lib/degradationLog';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useTheme } from '../theme/ThemeProvider';
import { AppText, Button } from './ui';

/**
 * Share dialog with a scannable QR for the latest Android APK — point a friend's
 * camera at the screen instead of typing a URL. Prefers the direct APK
 * download_url from the rolling manifest; falls back to the release page.
 */
export function ShareQrModal({
  visible,
  onClose,
  shareMessage,
}: {
  visible: boolean;
  onClose: () => void;
  shareMessage: string | null;
}) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const [apkUrl, setApkUrl] = useState<string | null>(null);
  const manifestUrls = useMemo(
    () =>
      apkManifestUrlsForDevice(
        Device.supportedCpuArchitectures,
        APK_MANIFEST_URL,
        APK_ARM_MANIFEST_URL,
      ),
    [],
  );
  const preferredReleaseTag =
    manifestUrls[0] === APK_ARM_MANIFEST_URL ? APK_ARM_RELEASE_TAG : APK_RELEASE_TAG;
  const releasePageUrl = `https://github.com/${REPO}/releases/tag/${preferredReleaseTag}`;

  useEffect(() => {
    if (!SELF_UPDATE_ENABLED || !visible || apkUrl) return;
    let alive = true;
    fetchBestCompatibleApkManifest(manifestUrls, Device.supportedCpuArchitectures)
      .then((m) => {
        if (alive && m?.download_url) setApkUrl(m.download_url);
      })
      .catch((err) => logSwallowedError('shareQr.apkManifest', err));
    return () => {
      alive = false;
    };
  }, [visible, apkUrl, manifestUrls]);

  const qrValue = SELF_UPDATE_ENABLED ? apkUrl ?? releasePageUrl : PLAY_STORE_URL;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion === false ? 'fade' : 'none'}
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Dismiss share dialog"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}
        />
        <View
          style={{
            width: '100%',
            maxWidth: 360,
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: 20,
            alignItems: 'center',
          }}
        >
          <AppText variant="h3" style={{ marginBottom: 4 }}>
            Share Australian Rates
          </AppText>
          <AppText variant="small" color="textMuted" style={{ marginBottom: 16, textAlign: 'center' }}>
            Scan with a phone camera to{' '}
            {SELF_UPDATE_ENABLED
              ? apkUrl
                ? 'download the latest Android APK'
                : 'open the latest release'
              : 'open Australian Rates in Google Play'}.
          </AppText>
          <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: theme.radius.md }}>
            <QRCode value={qrValue} size={208} />
          </View>
          <View style={{ alignSelf: 'stretch', marginTop: 20, gap: 10 }}>
            {shareMessage ? (
              <Button
                title="Share link instead"
                icon="share-social-outline"
                variant="secondary"
                onPress={() => {
                  void Share.share({ message: `${shareMessage}\nGet the app: ${qrValue}` });
                }}
              />
            ) : null}
            <Button title="Done" variant="ghost" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
