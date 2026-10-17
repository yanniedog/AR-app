import React from 'react';
import { View } from 'react-native';
import { ratesPageIndex, ratesPageWindow, type RatesPageSize } from '../data/ratesPagination';
import { uiCount, uiJoin, uiLabel } from '../lib/uiCopy';
import { SegmentedControl } from './controls';
import { AppText, Button, Row } from './ui';

export function RatesPagination({ total, page, size, noun = 'rates', onPage, onSize, pending = false }: {
  total: number; page: number; size: RatesPageSize; noun?: 'rates' | 'products';
  onPage: (page: number) => void; onSize: (size: RatesPageSize) => void; pending?: boolean;
}) {
  const window = ratesPageWindow(total, page, size);
  return <View testID="rates-pagination" style={{ width: '100%', gap: 10, paddingVertical: 16 }}>
    <AppText variant="small" accessibilityLiveRegion="polite">{pending ? uiLabel('Loading') : uiJoin(uiCount(window.from), '–', uiCount(window.to), ' / ', uiCount(window.total), ' ', noun)}</AppText>
    <AppText variant="small" weight="700">{uiLabel(noun === 'rates' ? 'Rates per page' : 'Products per page')}</AppText>
    <SegmentedControl value={String(size)} onChange={value => onSize(value === '10' ? 10 : 20)} options={[{ value: '10', label: uiCount(10) }, { value: '20', label: uiCount(20) }]} />
    <Row gap={4} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
      {ratesPageIndex(window.page, window.pages).map(item => typeof item === 'number'
        ? <Button key={item} title={uiCount(item)} accessibilityLabel={uiJoin('Page', ' ', uiCount(item))}
          accessibilityState={{ selected: item === window.page }} disabled={pending || item === window.page}
          variant={item === window.page ? 'secondary' : 'ghost'} style={{ paddingHorizontal: 8 }} onPress={() => onPage(item)} />
        : <AppText key={item} accessible={false} importantForAccessibility="no" style={{ alignSelf: 'center' }}>{uiLabel('…')}</AppText>)}
    </Row>
    <Row gap={8} style={{ flexWrap: 'wrap' }}>
      <Button title="First" accessibilityLabel="First page" variant="ghost" style={{ flexBasis: 110, flexGrow: 1 }} disabled={pending || !window.previous} onPress={() => onPage(1)} />
      <Button title="Previous" accessibilityLabel="Previous page" variant="ghost" style={{ flexBasis: 110, flexGrow: 1 }} disabled={pending || !window.previous} onPress={() => onPage(window.page - 1)} />
      <Button title="Next" accessibilityLabel="Next page" variant="ghost" style={{ flexBasis: 110, flexGrow: 1 }} disabled={pending || !window.next} onPress={() => onPage(window.page + 1)} />
      <Button title="Last" accessibilityLabel="Last page" variant="ghost" style={{ flexBasis: 110, flexGrow: 1 }} disabled={pending || !window.next} onPress={() => onPage(window.pages)} />
    </Row>
  </View>;
}
