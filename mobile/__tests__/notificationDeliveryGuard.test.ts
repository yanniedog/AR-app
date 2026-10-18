import * as Notifications from 'expo-notifications';
import { notify, type NotifyMessage } from '../src/data/notifications';
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


it.each(['permissions', 'earlier schedule'])('caps successful deliveries after revalidation during %s', async phase => {
  const candidates = [1, 2, 3, 4, 5].map(index => ({ title: uiJoin('Rate changed'), body: uiJoin('Rate changed', ': ', uiCount(index)) }));
  const revoked = new Set<NotifyMessage>();
  jest.spyOn(Notifications, 'getPermissionsAsync').mockImplementation(async () => {
    if (phase === 'permissions') revoked.add(candidates[0]);
    return { granted: true } as Notifications.NotificationPermissionsStatus;
  });
  const schedule = jest.spyOn(Notifications, 'scheduleNotificationAsync').mockImplementation(async () => {
    if (phase === 'earlier schedule') revoked.add(candidates[1]);
    return 'scheduled';
  });
  schedule.mockClear();
  await notify(candidates, async message => !revoked.has(message));
  const expected = phase === 'permissions' ? [1, 2, 3] : [0, 2, 3];
  expect(schedule.mock.calls.map(([request]) => request.content.body)).toEqual(expected.map(index => candidates[index].body));
  expect(schedule).toHaveBeenCalledTimes(3);
});
