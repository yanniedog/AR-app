import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import {
  TrustedExternalUrlProvider,
  useTrustedExternalUrl,
} from '../src/components/ExternalLinkConfirmation';

// React-test-renderer can be CPU-starved when the full suite runs in parallel
// on Windows. Keep a finite hang guard without relying on Jest's 5s default.
jest.setTimeout(15_000);

type TestNode = {
  props: Record<string, unknown>;
  findByProps: (props: Record<string, unknown>) => TestNode;
  findByType: (type: string) => TestNode;
};
type InspectableRenderer = ReactTestRenderer & { root: TestNode };

jest.mock('../src/theme/ThemeProvider', () => ({
  useTheme: () => ({
    colors: { surface: '#fff', border: '#ddd' },
  }),
}));

jest.mock('../src/components/ui', () => ({
  AppText: 'AppText',
  Button: 'Button',
  Row: 'Row',
}));

function RequestButton({ url }: { url: string }) {
  const { requestExternalUrl } = useTrustedExternalUrl();
  return React.createElement('RequestButton', {
    onPress: () => requestExternalUrl({
      url,
      purpose: 'official_economic_source',
      label: 'RBA statistics tables',
    }),
  });
}

describe('TrustedExternalUrlProvider', () => {
  it('shows the destination host and opens only after confirmation', async () => {
    const openUrl = jest.fn(async () => undefined);
    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <TrustedExternalUrlProvider openUrl={openUrl}>
          <RequestButton url="https://www.rba.gov.au/statistics/tables/" />
        </TrustedExternalUrlProvider>,
      ) as InspectableRenderer;
    });

    act(() => {
      (tree.root.findByType('RequestButton').props.onPress as () => void)();
    });
    expect(openUrl).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ testID: 'external-link-host' }).props.children).toBe(
      'www.rba.gov.au',
    );

    await act(async () => {
      (tree.root.findByProps({ title: 'Continue' }).props.onPress as () => void)();
      await Promise.resolve();
    });
    expect(openUrl).toHaveBeenCalledWith('https://www.rba.gov.au/statistics/tables/');
    expect(tree.root.findByProps({ visible: false })).toBeDefined();
    act(() => tree.unmount());
  });

  it('fails closed with recovery copy for a non-allowlisted or unopenable URL', async () => {
    const openUrl = jest.fn(async () => {
      throw new Error('no handler');
    });
    let tree!: InspectableRenderer;
    await act(async () => {
      tree = TestRenderer.create(
        <TrustedExternalUrlProvider openUrl={openUrl}>
          <RequestButton url="http://127.0.0.1/private" />
        </TrustedExternalUrlProvider>,
      ) as InspectableRenderer;
    });
    act(() => {
      (tree.root.findByType('RequestButton').props.onPress as () => void)();
    });
    expect(openUrl).not.toHaveBeenCalled();
    expect(tree.root.findByProps({ title: 'Back to app' })).toBeDefined();

    act(() => {
      (tree.root.findByProps({ title: 'Back to app' }).props.onPress as () => void)();
    });
    // Replace the invalid request with an approved one and prove a platform
    // open failure is converted into the same recoverable state.
    await act(async () => {
      tree.update(
        <TrustedExternalUrlProvider openUrl={openUrl}>
          <RequestButton url="https://www.rba.gov.au/statistics/tables/" />
        </TrustedExternalUrlProvider>,
      );
    });
    act(() => {
      (tree.root.findByType('RequestButton').props.onPress as () => void)();
    });
    await act(async () => {
      (tree.root.findByProps({ title: 'Continue' }).props.onPress as () => void)();
      await Promise.resolve();
    });
    expect(tree.root.findByProps({ title: 'Back to app' })).toBeDefined();
    act(() => tree.unmount());
  });
});
