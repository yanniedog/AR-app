import { AppRegistry, Platform } from 'react-native';

if (Platform.OS === 'android') {
  // Native TaskService owns completion after the last Expo event. Resolving a
  // no-op JS handler would immediately stop the timer lease (Expo #51304).
  AppRegistry.registerHeadlessTask('ar-expo-task-timers', () => () => new Promise<void>(() => {}));
}
