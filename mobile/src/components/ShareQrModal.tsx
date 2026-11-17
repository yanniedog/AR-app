import React, { useState } from 'react';
import { Platform, ScrollView, Share, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { APK_RELEASE_TAG, APK_REPO, IOS_INSTALL_URL, PLAY_STORE_URL, SELF_UPDATE_ENABLED } from '../config';
import { resolveShareInstallTarget } from '../lib/shareInstallTarget';
import { uiIdentifier, uiLabel } from '../lib/uiCopy';
import { SheetSurface } from './SheetSurface';
import { AppText, Button } from './ui';

const universalReleaseUrl = `https://github.com/${APK_REPO}/releases/tag/${APK_RELEASE_TAG}`;

export function ShareQrModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const qrSize = Math.min(232, Math.max(1, width - 56));
  const [sharing, setSharing] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const target = resolveShareInstallTarget({
    platform: Platform.OS,
    selfUpdateEnabled: SELF_UPDATE_ENABLED,
    // The recipient's ABI is unknown. Share the rolling universal release.
    apkUrl: null,
    releasePageUrl: universalReleaseUrl,
    playStoreUrl: PLAY_STORE_URL,
    iosInstallUrl: IOS_INSTALL_URL,
  });
  const close = () => {
    setShareFailed(false);
    onClose();
  };
  const share = async () => {
    if (!target || sharing) return;
    setSharing(true);
    setShareFailed(false);
    try {
      if (Platform.OS === 'ios') {
        await Share.share({ url: target.url });
      } else {
        await Share.share({ title: 'Australian Rates', message: uiIdentifier(target.url) });
      }
    } catch {
      setShareFailed(true);
    } finally {
      setSharing(false);
    }
  };

  return (
    <SheetSurface title="Share app" visible={visible} onClose={close}>
      <ScrollView contentContainerStyle={{ gap: 16, padding: 16, paddingTop: 0 }}>
        {target ? <>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel="App install QR code"
            style={{ alignSelf: 'center', backgroundColor: '#ffffff', borderRadius: 8, overflow: 'hidden' }}
          >
            <QRCode value={target.url} size={qrSize} quietZone={qrSize / 5} color="#000000" backgroundColor="#ffffff" />
          </View>
          <Button title="Share link" icon="share-outline" onPress={() => void share()} loading={sharing} />
          {shareFailed ? <AppText color="danger" accessibilityRole="alert">{uiLabel('Share failed')}</AppText> : null}
        </> : <AppText>{uiLabel('Link unavailable')}</AppText>}
      </ScrollView>
    </SheetSurface>
  );
}
