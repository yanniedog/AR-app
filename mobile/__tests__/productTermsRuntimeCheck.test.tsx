import { readFileSync } from 'fs';
import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { EVALUATOR_VERSION } from '../src/lib/productTermsEngine/types';

jest.mock('../src/lib/debugLog', () => ({ debugLog: { info: jest.fn() } }));
jest.mock('../src/components/ui', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    AppText: 'AppText', Button: 'Button',
    Disclosure: ({ children, open, ...props }: any) => React.createElement('Disclosure', { open, ...props }, open ? children : null),
  };
});
// eslint-disable-next-line import/first -- native presentation mocks above
import { ProductTermsRuntimeCheck } from '../src/components/ProductTermsRuntimeCheck';
// eslint-disable-next-line import/first -- local logging mock above
import { debugLog } from '../src/lib/debugLog';

test('explicit diagnostics action executes real primitives and preserves the actual runtime result', () => {
  let tree!: ReactTestRenderer & { root: any; toJSON: () => unknown };
  act(() => { tree = TestRenderer.create(<ProductTermsRuntimeCheck />) as typeof tree; });
  expect(debugLog.info).not.toHaveBeenCalled();
  act(() => tree.root.findByProps({ title: 'Evaluator runtime' }).props.onToggle());
  expect(debugLog.info).not.toHaveBeenCalled();
  act(() => tree.root.findByProps({ title: 'Run runtime check' }).props.onPress());
  const [tag, message] = (debugLog.info as jest.Mock).mock.calls[0];
  const result = JSON.parse(message);
  expect(tag).toBe('productTermsRuntime');
  expect(result).toEqual({ evaluatorVersion: EVALUATOR_VERSION, runtime: 'other', passed: true, checks: {
    bigintBeyondSafeInteger: true, exactRational: true, negativeTieRounding: true, leapMonthEnd: true,
  } });
  const rendered = JSON.stringify(tree.toJSON());
  expect(rendered).toContain(EVALUATOR_VERSION);
  expect(rendered).toContain('runtime=other; passed=true');
  expect(rendered).toContain('does not verify Hermes');
  act(() => tree.unmount());
});

test('existing debug-log route includes the explicit runtime harness', () => {
  const screen = readFileSync(require.resolve('../app/debug-log.tsx'), 'utf8');
  expect(screen).toContain('<ProductTermsRuntimeCheck />');
  const about = readFileSync(require.resolve('../app/about.tsx'), 'utf8');
  expect(about).toContain("router.push('/debug-log')");
});
