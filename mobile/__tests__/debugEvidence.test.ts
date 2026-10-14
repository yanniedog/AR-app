import { Share } from 'react-native';
import * as Application from 'expo-application';
import { debugLog, formatVersionedLogExport } from '../src/lib/debugLog';
import { readVersionedDebugEvidence, shareVersionedDebugEvidence } from '../src/lib/debugEvidence';

jest.mock('../src/lib/debugLog', () => ({
  debugLog: { readCompleteText: jest.fn() },
  formatVersionedLogExport: jest.fn(),
}));
jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.2.3', nativeBuildVersion: '42' }));

beforeEach(() => {
  jest.mocked(debugLog.readCompleteText).mockReset().mockResolvedValue('complete source log');
  jest.mocked(formatVersionedLogExport).mockReset().mockReturnValue('versioned actual evidence');
});

test.each([false, true])('exports complete evidence with installed metadata and explicit full mode %s', async fullEvidence => {
  await expect(readVersionedDebugEvidence(fullEvidence)).resolves.toBe('versioned actual evidence');
  expect(debugLog.readCompleteText).toHaveBeenCalledTimes(1);
  expect(formatVersionedLogExport).toHaveBeenCalledWith('complete source log', Application.nativeApplicationVersion,
    Application.nativeBuildVersion, {}, { fullEvidence });
});

test('native sharing reads its own evidence rather than accepting message content', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  try {
    await shareVersionedDebugEvidence(true);
    expect(share).toHaveBeenCalledWith({ message: 'versioned actual evidence', title: 'Debug log' });
    expect(formatVersionedLogExport).toHaveBeenCalledWith('complete source log', '1.2.3', '42', {}, { fullEvidence: true });
  } finally { share.mockRestore(); }
});

test('read failure prevents native disclosure', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  jest.mocked(debugLog.readCompleteText).mockRejectedValueOnce(new Error('read failed'));
  try {
    await expect(shareVersionedDebugEvidence()).rejects.toThrow('read failed');
    expect(share).not.toHaveBeenCalled();
  } finally { share.mockRestore(); }
});
