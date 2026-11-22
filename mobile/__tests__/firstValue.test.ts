import { afterFirstValue, cooperativeSliceMs, expectFirstValue, markFirstValue, resetFirstValueForTests } from '../src/lib/firstValue';

describe('first value wait', () => {
  afterEach(() => { resetFirstValueForTests(); jest.useRealTimers(); });

  it('does not wait unless launch armed it', async () => {
    await expect(afterFirstValue(10_000)).resolves.toBeUndefined();
  });

  it('waits for the first value, then releases every waiter', async () => {
    expectFirstValue();
    let released = 0;
    const waits = [afterFirstValue(), afterFirstValue()].map((p) => p.then(() => { released += 1; }));
    await Promise.resolve();
    expect(released).toBe(0);
    markFirstValue();
    await Promise.all(waits);
    expect(released).toBe(2);
    await expect(afterFirstValue()).resolves.toBeUndefined();
  });

  it('gives up after the bound so background writes still happen', async () => {
    jest.useFakeTimers();
    expectFirstValue();
    let released = false;
    const wait = afterFirstValue(5_000).then(() => { released = true; });
    await jest.advanceTimersByTimeAsync(4_999);
    expect(released).toBe(false);
    await jest.advanceTimersByTimeAsync(2);
    await wait;
    expect(released).toBe(true);
  });

  it('uses the caller base slice once first value has settled and a longer one before', () => {
    expect(cooperativeSliceMs()).toBe(6);
    expect(cooperativeSliceMs(4)).toBe(4);
    expectFirstValue();
    expect(cooperativeSliceMs()).toBe(24);
    expect(cooperativeSliceMs(4)).toBe(24);
    markFirstValue();
    expect(cooperativeSliceMs(4)).toBe(4);
  });
});
