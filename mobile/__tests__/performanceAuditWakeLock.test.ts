import { createPerformanceAuditWakeLock } from '../src/lib/performanceAuditWakeLock';

describe('audit wake lock', () => {
  it('refreshes on subsequent acquisitions and releases at teardown', async () => {
    const activate = jest.fn(async () => {});
    const deactivate = jest.fn(async () => {});
    const lock = createPerformanceAuditWakeLock(activate, deactivate);
    await lock.acquire();
    await lock.acquire();
    expect(activate).toHaveBeenCalledTimes(2);
    await lock.release();
    await lock.acquire();
    expect(activate).toHaveBeenCalledTimes(2);
    expect(deactivate).toHaveBeenCalledTimes(1);
  });

  it('releases a native activation that finishes after cancellation', async () => {
    let finish!: () => void;
    const activate = jest.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const deactivate = jest.fn(async () => {});
    const lock = createPerformanceAuditWakeLock(activate, deactivate);
    const first = lock.acquire();
    expect(lock.acquire()).toBe(first);
    await Promise.resolve();
    await lock.release();
    finish();
    await first;
    expect(deactivate).toHaveBeenCalledTimes(2);
    await lock.acquire();
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('allows retry after a failed foreground activation', async () => {
    const activate = jest.fn().mockRejectedValueOnce(new Error('no activity')).mockResolvedValue(undefined);
    const lock = createPerformanceAuditWakeLock(activate, async () => {});
    await expect(lock.acquire()).rejects.toThrow('no activity');
    await lock.acquire();
    expect(activate).toHaveBeenCalledTimes(2);
    await lock.release();
  });
});
