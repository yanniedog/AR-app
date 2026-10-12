import { connectivityFromNetworkState, dataUnavailableMessage } from '../src/lib/dataUnavailableCopy';

describe('data unavailable copy', () => {
  it('blames the connection only when the device reports it is offline', () => {
    expect(dataUnavailableMessage('offline')).toMatch(/offline/i);
    expect(dataUnavailableMessage('online')).toBe('We couldn’t load the rates. Try again in a moment.');
    expect(dataUnavailableMessage(null)).toMatch(/check your connection/i);
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
