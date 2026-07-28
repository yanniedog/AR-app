import { InteractionManager } from 'react-native';

import { parseJsonHeavy, yieldToUi, yieldToUiFrames } from '../src/lib/yieldToUi';

describe('yieldToUi', () => {
  let runSpy: jest.SpyInstance;

  beforeEach(() => {
    runSpy = jest
      .spyOn(InteractionManager, 'runAfterInteractions')
      // RN InteractionManager task typing is a union; keep the spy simple.
      .mockImplementation(((task?: unknown) => {
        if (typeof task === 'function') (task as () => void)();
        return { cancel: jest.fn(), then: jest.fn(), done: jest.fn() };
      }) as typeof InteractionManager.runAfterInteractions);
  });

  afterEach(() => {
    runSpy.mockRestore();
  });

  it('resolves after flushing interactions', async () => {
    await expect(yieldToUi(5)).resolves.toBeUndefined();
    expect(runSpy).toHaveBeenCalled();
  });

  it('yieldToUiFrames awaits multiple yields', async () => {
    await yieldToUiFrames(2, 5);
    expect(runSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('parseJsonHeavy yields then parses', async () => {
    const value = await parseJsonHeavy<{ ok: boolean }>('{"ok":true}');
    expect(value).toEqual({ ok: true });
    expect(runSpy).toHaveBeenCalled();
  });
});
