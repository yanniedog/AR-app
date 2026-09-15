import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useDetailsCatalogue } from '../src/hooks/useDetailsCatalogue';
import { detailsOnlyCatalogue } from '../src/data/detailsCatalogue';
import { ScreenScrollView } from '../src/components/Screen';
import { AppText, Button } from '../src/components/ui';
import { LedgerField } from '../src/components/ledger/LedgerField';
const PAGE = 25;
export default function DetailsCatalogue() {
  const { core, details, loading, retry } = useDetailsCatalogue(), [query, setQuery] = useState(''), [page, setPage] = useState(0);
  const entries = useMemo(() => core && details ? detailsOnlyCatalogue(core, details) : [], [core, details]);
  const matched = useMemo(() => { const term = query.trim().toLocaleLowerCase(); return entries.filter(item => !term || `${item.key} ${item.name ?? ''} ${item.provider ?? ''} ${item.productCategory ?? ''} ${item.description}`.toLocaleLowerCase().includes(term)); }, [entries, query]);
  const selectedPage = Math.min(page, Math.max(0, Math.ceil(matched.length / PAGE) - 1));
  return <ScreenScrollView><Stack.Screen options={{ title: 'Products without listed rates' }} /><View style={{ gap: 12 }}>
    <AppText variant="small">Published product details without listed rates.</AppText>
    <LedgerField label="Search products" value={query} onChangeText={value => { setQuery(value); setPage(0); }} />
    {!details ? loading ? <AppText variant="small">Loading verified catalogue...</AppText> : <><AppText variant="small">Product details could not be verified.</AppText><Button title="Retry catalogue" variant="secondary" onPress={retry} /></> : <>
      <AppText variant="small">{matched.length} products · Page {selectedPage + 1} of {Math.max(1, Math.ceil(matched.length / PAGE))}</AppText>
      {matched.slice(selectedPage * PAGE, (selectedPage + 1) * PAGE).map(item => <View key={item.key} style={{ gap: 4 }}>
        <Button title={`Open product ${item.name ?? item.key}`} variant="secondary" onPress={() => router.push({ pathname: '/product/[key]', params: { key: item.key } })} />
        {(item.provider || item.productCategory) && <AppText variant="small">{[item.provider, item.productCategory].filter(Boolean).join(' · ')}</AppText>}
        {item.description ? <AppText variant="small">{item.description}</AppText> : null}
      </View>)}
      {selectedPage > 0 && <Button title="Previous page" variant="secondary" onPress={() => setPage(selectedPage - 1)} />}
      {(selectedPage + 1) * PAGE < matched.length && <Button title="Next page" variant="secondary" onPress={() => setPage(selectedPage + 1)} />}
    </>}
  </View></ScreenScrollView>;
}
