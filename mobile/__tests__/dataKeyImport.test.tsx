import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { TextInput } from 'react-native';
import { DataKeyImport } from '../src/components/settings/DataKeyImport';
import { importPayloadSetupKey } from '../src/lib/keyVault';

jest.mock('../src/lib/keyVault', () => ({ importPayloadSetupKey: jest.fn() }));
jest.mock('../src/theme/ThemeProvider', () => ({ useTheme: () => ({ colors: { text: '#fff', border: '#888' } }) }));
jest.mock('../src/components/ui', () => ({ AppText: 'AppText', Button: 'Button' }));
jest.mock('../src/components/settings/settingsUi', () => ({ DisclosureGroup: 'DisclosureGroup' }));

test('private import clears the masked field and reports only the key ID', async () => {
  let finish!: (id: string) => void;
  (importPayloadSetupKey as jest.Mock).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  let tree!: any;
  await act(async () => { tree = TestRenderer.create(<DataKeyImport />); });
  const input = () => tree.root.findByType(TextInput);
  expect(input().props.secureTextEntry).toBe(true);
  act(() => input().props.onChangeText('private-input-not-for-output'));
  await act(async () => tree.root.findByProps({ title: 'Import key' }).props.onPress());
  expect(input().props.value).toBe('');
  expect(input().props.editable).toBe(false);
  await act(async () => finish('12345678'));
  expect(JSON.stringify(tree.toJSON())).not.toContain('private-input-not-for-output');
  expect(JSON.stringify(tree.toJSON())).toContain('Key 12345678 imported');
  act(() => tree.unmount());
});

test('failed import never displays a native error or private input', async () => {
  (importPayloadSetupKey as jest.Mock).mockRejectedValue(new Error('private-value-in-native-error'));
  let tree!: any;
  await act(async () => { tree = TestRenderer.create(<DataKeyImport />); });
  act(() => tree.root.findByType(TextInput).props.onChangeText('private-input'));
  await act(async () => tree.root.findByProps({ title: 'Import key' }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('Import failed');
  expect(JSON.stringify(tree.toJSON())).not.toContain('private-value-in-native-error');
  expect(tree.root.findByType(TextInput).props.value).toBe('');
  act(() => tree.unmount());
});
