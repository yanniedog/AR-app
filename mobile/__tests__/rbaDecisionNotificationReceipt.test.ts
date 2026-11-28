import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  claimRbaDecisionNotificationReceipts,
  rbaDecisionNotificationIdentity,
} from '../src/data/rbaDecisionNotificationReceipt';

jest.mock(
  '@react-native-async-storage/async-storage',
  () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('durably claims an official RBA decision only once', async () => {
  const id = rbaDecisionNotificationIdentity({
    date: '2026-06-16',
    effective: '2026-06-17',
    rate: 4.1,
    delta_bps: 25,
    outcome: 'hike',
  });
  await expect(claimRbaDecisionNotificationReceipts([id])).resolves.toEqual([id]);
  expect(await AsyncStorage.getItem('ar-rates:rba-decision-notification-receipts:v1')).toContain(id);
  await expect(claimRbaDecisionNotificationReceipts([id])).resolves.toEqual([]);
});

it('serialises concurrent claims so only one caller can notify', async () => {
  const id = '2026-06-16||3.85|0|hold';
  const [first, second] = await Promise.all([
    claimRbaDecisionNotificationReceipts([id]),
    claimRbaDecisionNotificationReceipts([id]),
  ]);
  expect([first, second]).toContainEqual([id]);
  expect([first, second]).toContainEqual([]);
});
