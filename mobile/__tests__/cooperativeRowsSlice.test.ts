import { rowWork } from '../src/data/cooperativeRows';
import { expectFirstValue, markFirstValue, resetFirstValueForTests } from '../src/lib/firstValue';

describe('rowWork slice', () => {
  afterEach(() => resetFirstValueForTests());

  it('lets a pass run longer before first value settles, then returns to the short slice', () => {
    let clock = 0;
    const control = { now: () => clock };
    expectFirstValue();
    const pending = rowWork(control);
    clock = 10;
    expect(pending.expired()).toBe(false);
    clock = 24;
    expect(pending.expired()).toBe(true);

    markFirstValue();
    const settled = rowWork(control);
    clock = 24 + 5;
    expect(settled.expired()).toBe(false);
    clock = 24 + 6;
    expect(settled.expired()).toBe(true);
  });
});
