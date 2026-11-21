import { bootCount, bootMark, resetBootTraceForTests } from '../src/lib/bootTrace';
import { debugLog } from '../src/lib/debugLog';

describe('boot trace', () => {
  beforeEach(() => resetBootTraceForTests());

  it('writes one launch line when Rates is ready and ignores later marks', async () => {
    const warn = jest.spyOn(debugLog, 'warn').mockImplementation(() => undefined);
    bootMark('js-start');
    bootMark('hydrated');
    bootMark('rates-ready');
    bootMark('core-ready');
    bootMark('rates-ready');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(warn).toHaveBeenCalledTimes(1);
    const [tag, text] = warn.mock.calls[0] as [string, string];
    expect(tag).toBe('boot');
    expect(text).toMatch(/^launch ms js-start=\d+ hydrated=\d+ rates-ready=\d+$/);
    warn.mockRestore();
  });

  it('appends summed counters to the launch line', () => {
    const warn = jest.spyOn(debugLog, 'warn').mockImplementation(() => undefined);
    bootMark('js-start');
    bootCount('row-runs');
    bootCount('row-runs');
    bootCount('filter-ms', 12.4);
    bootMark('rates-ready');
    bootCount('row-runs');
    expect((warn.mock.calls[0] as [string, string])[1]).toMatch(/^launch ms js-start=\d+ rates-ready=\d+ row-runs=2 filter-ms=12$/);
    warn.mockRestore();
  });
});
