import {
  connectivityFromNetworkState,
  DATA_UNAVAILABLE_MESSAGES,
  dataUnavailableMessage,
} from '../src/lib/dataUnavailableCopy';

describe('data unavailable copy', () => {
  it('picks the message for each connectivity state', () => {
    expect(dataUnavailableMessage('offline')).toBe(DATA_UNAVAILABLE_MESSAGES.offline);
    expect(dataUnavailableMessage('online')).toBe(DATA_UNAVAILABLE_MESSAGES.online);
    expect(dataUnavailableMessage(null)).toBe(DATA_UNAVAILABLE_MESSAGES.unknown);
  });

  it('blames the connection only when the device reports it is offline', () => {
    expect(DATA_UNAVAILABLE_MESSAGES.offline).toMatch(/offline/i);
    // Online: no connection advice, and no guessed cause for the failure.
    expect(DATA_UNAVAILABLE_MESSAGES.online).not.toMatch(/offline|check your connection|connect to/i);
    expect(DATA_UNAVAILABLE_MESSAGES.online).not.toMatch(/didn.t respond|server|service/i);
    expect(DATA_UNAVAILABLE_MESSAGES.unknown).toMatch(/check your connection/i);
  });

  it('reads expo-network state conservatively', () => {
    expect(connectivityFromNetworkState({ isConnected: false, isInternetReachable: null })).toBe('offline');
    expect(connectivityFromNetworkState({ isConnected: true, isInternetReachable: false })).toBe('offline');
    expect(connectivityFromNetworkState({ isConnected: true, isInternetReachable: true })).toBe('online');
    // Reachability not yet known: do not claim either way.
    expect(connectivityFromNetworkState({ isConnected: true, isInternetReachable: null })).toBeNull();
    expect(connectivityFromNetworkState(null)).toBeNull();
  });
});
