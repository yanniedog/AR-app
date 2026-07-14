import { InteractionManager } from 'react-native';

/**
 * Yield the JS thread so React can paint / handle touches before the next
 * heavy sync burst (large JSON.parse, hierarchy rebuild, file IO, etc.).
 */
export function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    InteractionManager.runAfterInteractions(() => {
      resolve();
    });
  });
}
