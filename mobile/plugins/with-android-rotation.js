const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

// Leave the iOS portrait configuration in place. Android follows the device's
// orientation and rotation lock, while MainActivity handles orientation changes.
module.exports = config => withAndroidManifest(config, result => {
  const activity = AndroidConfig.Manifest.getMainActivityOrThrow(result.modResults);
  activity.$['android:screenOrientation'] = 'user';
  return result;
});
