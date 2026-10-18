import * as Notifications from 'expo-notifications';
import { notify } from '../src/data/notifications';
import { uiCount, uiJoin } from '../src/lib/uiCopy';

const messages = [1, 2].map(index => ({ title: uiJoin('Rate changed'), body: uiJoin('Rate changed', ': ', uiCount(index)) }));
afterEach(() => { jest.restoreAllMocks(); });

it('rechecks delivery authorization after asynchronous permission acquisition', async () => {
  let enabled = true;
  jest.spyOn(Notifications, 'getPermissionsAsync').mockImplementationOnce(async () => {
    enabled = false;
    return { granted: true } as Notifications.NotificationPermissionsStatus;
  });
  const schedule = jest.spyOn(Notifications, 'scheduleNotificationAsync');
  schedule.mockClear();
  await notify(messages, () => enabled);
  expect(schedule).not.toHaveBeenCalled();
});

it('rechecks each message after an earlier scheduling call completes', async () => {
  let enabled = true;
  jest.spyOn(Notifications, 'getPermissionsAsync').mockResolvedValue({ granted: true } as Notifications.NotificationPermissionsStatus);
  const schedule = jest.spyOn(Notifications, 'scheduleNotificationAsync').mockImplementation(async () => {
    enabled = false; return 'scheduled';
  });
  schedule.mockClear();
  await notify(messages, async () => enabled);
  expect(schedule).toHaveBeenCalledTimes(1);
});
