declare module 'react-test-renderer' {
  import type { ReactElement } from 'react';

  export function act(callback: () => void | Promise<void>): void | Promise<void>;

  export type ReactTestRenderer = {
    update(element: ReactElement): void;
    unmount(): void;
  };

  const TestRenderer: {
    create(element: ReactElement): ReactTestRenderer;
  };
  export default TestRenderer;
}
