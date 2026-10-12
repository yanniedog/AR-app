// Metro runtime stays first for web/Fast Refresh; task definitions must execute
// even when Expo starts only the JS host, without mounting any React route.
import '@expo/metro-runtime';
import './src/background/headlessTimers';
import './src/background/tasks';
import 'expo-router/entry';
