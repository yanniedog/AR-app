import {
  applyLogoRenderState,
  summarizeLogoRenderStates,
} from '../src/lib/logoReadiness';

describe('logo readiness', () => {
  test('is ready only after every expected rendered logo reaches a terminal state', () => {
    let states = new Map();
    states = applyLogoRenderState(states, 'row:1', 'pending');
    states = applyLogoRenderState(states, 'row:2', 'pending');
    expect(summarizeLogoRenderStates(states)).toEqual({
      expectedCount: 2,
      terminalCount: 0,
      ready: false,
    });
    states = applyLogoRenderState(states, 'row:1', 'decoded');
    states = applyLogoRenderState(states, 'row:2', 'initials');
    expect(summarizeLogoRenderStates(states)).toEqual({
      expectedCount: 2,
      terminalCount: 2,
      ready: true,
    });
  });

  test('tracks only currently mounted virtualized rows plus fixed header logos', () => {
    let states = applyLogoRenderState(new Map(), 'visible:1', 'decoded');
    expect(summarizeLogoRenderStates(states, ['header'])).toEqual({
      expectedCount: 2,
      terminalCount: 1,
      ready: false,
    });
    states = applyLogoRenderState(states, 'header', 'initials');
    states = applyLogoRenderState(states, 'visible:1', 'unmounted');
    expect(summarizeLogoRenderStates(states, ['header'])).toEqual({
      expectedCount: 1,
      terminalCount: 1,
      ready: true,
    });
  });
});
