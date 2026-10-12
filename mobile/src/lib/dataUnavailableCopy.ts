/** Device connectivity as far as the OS can tell; null when it cannot be read. */
export type Connectivity = 'online' | 'offline' | null;

/**
 * A failed first load means "no verified rates", not necessarily "no
 * network": the store marks any refresh failure offline. Ask the device so
 * the message does not blame a working connection for a service problem.
 */
export function dataUnavailableMessage(connectivity: Connectivity): string {
  if (connectivity === 'offline') {
    return 'You’re offline. Connect to the internet to download today’s rates.';
  }
  if (connectivity === 'online') {
    return 'Your connection is working, but the rates service didn’t respond. Try again in a moment.';
  }
  return 'We couldn’t load the rates. Check your connection and try again.';
}

export function connectivityFromNetworkState(
  state: { isConnected?: boolean | null; isInternetReachable?: boolean | null } | null | undefined,
): Connectivity {
  if (!state) return null;
  if (state.isConnected === false || state.isInternetReachable === false) return 'offline';
  if (state.isConnected === true && state.isInternetReachable === true) return 'online';
  return null;
}
