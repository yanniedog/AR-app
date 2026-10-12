/** Device connectivity as far as the OS can tell; null when it cannot be read. */
export type Connectivity = 'online' | 'offline' | null;

export const DATA_UNAVAILABLE_MESSAGES = {
  offline: 'You’re offline. Connect to the internet to download today’s rates.',
  // Online failures include cache, manifest and validation errors, so name no cause.
  online: 'Your connection is working, but today’s rates couldn’t be loaded. Try again in a moment.',
  unknown: 'We couldn’t load the rates. Check your connection and try again.',
} as const;

/**
 * A failed first load means "no verified rates", not necessarily "no
 * network": the store marks any refresh failure offline. Ask the device so
 * the message does not blame a working connection.
 */
export function dataUnavailableMessage(connectivity: Connectivity): string {
  if (connectivity === 'offline') return DATA_UNAVAILABLE_MESSAGES.offline;
  if (connectivity === 'online') return DATA_UNAVAILABLE_MESSAGES.online;
  return DATA_UNAVAILABLE_MESSAGES.unknown;
}

export function connectivityFromNetworkState(
  state: { isConnected?: boolean | null; isInternetReachable?: boolean | null } | null | undefined,
): Connectivity {
  if (!state) return null;
  if (state.isConnected === false || state.isInternetReachable === false) return 'offline';
  if (state.isConnected === true && state.isInternetReachable === true) return 'online';
  return null;
}
