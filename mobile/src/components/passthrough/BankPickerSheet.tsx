import React, { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { orderProviders } from '../../data/bankGroups';
import { uiProviderName, useProviderSearchInput } from '../../lib/uiCopy';
import { useTheme } from '../../theme/ThemeProvider';
import { BankAvatar } from '../BankAvatar';
import { SearchBar } from '../controls';
import Ionicons from '../icons/AppIcon';
import { SheetSurface } from '../SheetSurface';
import { AppText, Row } from '../ui';

export function BankPickerSheet({ visible, providers, selected, saved, onSelect, onClose }: {
  visible: boolean;
  providers: readonly string[];
  selected: string;
  saved: ReadonlySet<string>;
  onSelect: (provider: string) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const { value: query, raw, onChangeText, reset } = useProviderSearchInput();
  const ordered = useMemo(() => orderProviders(providers, (provider) => provider, saved, raw), [providers, raw, saved]);
  const close = () => { reset(); onClose(); };
  return <SheetSurface visible={visible} title="Choose bank" onClose={close}>
    <View style={{ gap: 12 }}>
      <SearchBar value={query} onChangeText={onChangeText} placeholder="Search banks" />
      <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" testID="bank-picker-list">
        {ordered.map((provider) => (
          <Pressable
            key={provider}
            accessibilityRole="button"
            accessibilityState={{ selected: provider === selected }}
            accessibilityLabel={uiProviderName({ provider })}
            onPress={() => { onSelect(provider); close(); }}
            style={{ minHeight: 48, justifyContent: 'center', borderBottomWidth: 1, borderColor: theme.colors.border }}
          >
            <Row gap={10} style={{ alignItems: 'center' }}>
              <BankAvatar provider={provider} size={24} />
              <AppText variant="small" weight={provider === selected ? '700' : '400'} numberOfLines={1} style={{ flex: 1 }}>
                {uiProviderName({ provider })}
              </AppText>
              {saved.has(provider) ? <Ionicons name="star" size={14} color={theme.colors.primary} /> : null}
            </Row>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  </SheetSurface>;
}
