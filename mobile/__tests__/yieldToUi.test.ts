import { InteractionManager } from 'react-native';

import {
  parseJsonHeavy,
  scheduleAfterInteractions,
  scheduleAfterNavigation,
  yieldToUi,
  yieldToUiFrames,
} from '../src/lib/yieldToUi';

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

  it('cancels deferred work before a blurred screen callback can run', () => {
    let callback: (() => void) | undefined;
    const cancel = jest.fn();
    runSpy.mockImplementationOnce(((task?: unknown) => {
      callback = typeof task === 'function' ? task as () => void : undefined;
      return { cancel, then: jest.fn(), done: jest.fn() };
    }) as typeof InteractionManager.runAfterInteractions);
    const work = jest.fn();

    const cleanup = scheduleAfterInteractions(work);
    cleanup();
    callback?.();

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(work).not.toHaveBeenCalled();
  });

  it('runs deferred required work when interactions never settle', () => {
    jest.useFakeTimers();
    runSpy.mockImplementationOnce((() => (
      { cancel: jest.fn(), then: jest.fn(), done: jest.fn() }
    )) as typeof InteractionManager.runAfterInteractions);
    const work = jest.fn();

    scheduleAfterInteractions(work);
    jest.advanceTimersByTime(48);

    expect(work).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('still defers work when InteractionManager throws', () => {
    jest.useFakeTimers();
    runSpy.mockImplementationOnce(() => {
      throw new Error('InteractionManager unavailable');
    });
    const work = jest.fn();

    scheduleAfterInteractions(work);
    expect(work).not.toHaveBeenCalled();
    jest.advanceTimersByTime(48);

    expect(work).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('uses a navigation-sized fallback without running cancelled work', () => {
    jest.useFakeTimers();
    const cancel = jest.fn();
    runSpy.mockImplementationOnce((() => (
      { cancel, then: jest.fn(), done: jest.fn() }
    )) as typeof InteractionManager.runAfterInteractions);
    const work = jest.fn();

    const cleanup = scheduleAfterNavigation(work, 500);
    jest.advanceTimersByTime(499);
    expect(work).not.toHaveBeenCalled();
    cleanup();
    jest.advanceTimersByTime(1);

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(work).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('does not run navigation work immediately when interactions are already idle', () => {
    jest.useFakeTimers();
    const work = jest.fn();

    scheduleAfterNavigation(work);
    expect(work).not.toHaveBeenCalled();
    jest.advanceTimersByTime(179);
    expect(work).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);

    expect(work).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });
});
