import { uiLabel } from '../../lib/uiCopy';
import React, { useEffect, useState } from 'react';
import { AppState, TextInput, View } from 'react-native';

import { importPayloadSetupKey } from '../../lib/keyVault';
import { useTheme } from '../../theme/ThemeProvider';
import { AppText, Button } from '../ui';
import { DisclosureGroup } from './settingsUi';
import { useSetupKeyInput, uiIdentifier, uiJoin, type UiCopy } from '../../lib/uiCopy';

export function DataKeyImport() {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const input = useSetupKeyInput();
  const text = input.raw;
  const setText = input.onChangeText;
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<UiCopy>('');
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active') setText('');
    });
    return () => listener.remove();
  }, [setText]);
  async function save() {
    setBusy(true);
    setText('');
    setMessage('');
    try {
      const id = await importPayloadSetupKey(text);
      setMessage(uiJoin('Key imported', ': ', uiIdentifier(id)));
    } catch {
      setMessage('Import failed');
    } finally {
      setBusy(false);
    }
  }
  return <DisclosureGroup title="Data key" open={open}
    onOpenChange={value => { setOpen(value); setText(''); setMessage(''); }}>
    <View style={{ gap: 12 }}>
      <AppText variant="small">{uiLabel("Local only · Encrypted")}</AppText>
      <TextInput accessibilityLabel="Private setup key" placeholder="Paste setup key" value={input.value}
        onChangeText={setText} editable={!busy} maxLength={1024} secureTextEntry
        autoCorrect={false} autoCapitalize="none" autoComplete="off" textContentType="none"
        style={{ minHeight: 48, padding: 12, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.border }} />
      <Button title={busy ? 'Importing' : 'Import key'} disabled={busy || !text} onPress={() => void save()} />
      <Button title="Cancel" variant="ghost" disabled={busy} onPress={() => { setText(''); setMessage(''); setOpen(false); }} />
      {message ? <AppText variant="small" accessibilityLiveRegion="polite">{message}</AppText> : null}
    </View>
  </DisclosureGroup>;
}
