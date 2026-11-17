import { createAuditNativeFrameCapture } from '../src/lib/auditNativeFrameCapture';

const frames = {
  refreshRateHz: 60, frameOverrunP95Ms: 3, jankPercent: 8, frozenFrameCount: 0,
  totalFrameCount: 20, droppedFrameCallbackCount: 0, frameDeadlineCount: 18,
};

test('retains foreground segments across an interruption with no full-run score input', () => {
  const start = jest.fn(() => true);
  const stop = jest.fn()
    .mockReturnValueOnce(frames)
    .mockReturnValueOnce({ ...frames, totalFrameCount: 10, droppedFrameCallbackCount: 2, frameDeadlineCount: 0 });
  const capture = createAuditNativeFrameCapture(start, stop);
  capture.setPaused(false);
  capture.setPaused(false);
  capture.setPaused(true);
  capture.setPaused(false);
  expect(capture.finish()).toEqual({
    androidFrameCapture: 'interrupted',
    androidFrameSegments: { attempted: 2, observed: 2, frames: 30, droppedFrames: 2, deadlineFrames: 18 },
  });
  capture.setPaused(true);
  capture.finish();
  expect(start).toHaveBeenCalledTimes(2);
  expect(stop).toHaveBeenCalledTimes(2);
});

test('only an uninterrupted trace with observed zero dropped callbacks supplies a native score input', () => {
  for (const [drops, status] of [[0, 'collected'], [2, 'dropped-callbacks'], [undefined, 'drop-count-unavailable']] as const) {
    const capture = createAuditNativeFrameCapture(() => true, () => ({ ...frames, droppedFrameCallbackCount: drops }));
    capture.setPaused(false);
    const result = capture.finish();
    expect(result.androidFrameCapture).toBe(status);
    expect(result.androidFluidity !== undefined).toBe(drops === 0);
  }
});
