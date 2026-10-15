const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

/** Keep the existing React surface while Android updates the user's font setting. */
function addMainActivityFontScale(androidManifest) {
  const main = AndroidConfig.Manifest.getMainActivityOrThrow(androidManifest);
  const activities = androidManifest.manifest.application[0].activity;
  if (activities.filter(activity => activity.$?.['android:name'] === '.MainActivity').length !== 1) {
    throw new Error('AndroidManifest.xml must contain exactly one .MainActivity');
  }
  const existing = main.$['android:configChanges'];
  if (existing !== undefined && typeof existing !== 'string') {
    throw new Error('MainActivity android:configChanges must be a string');
  }
  if (!(existing ?? '').split('|').some(flag => flag.trim() === 'fontScale')) {
    main.$['android:configChanges'] = existing ? `${existing}|fontScale` : 'fontScale';
  }
  return androidManifest;
}

module.exports = config => withAndroidManifest(config, result => {
  addMainActivityFontScale(result.modResults);
  return result;
});
module.exports.addMainActivityFontScale = addMainActivityFontScale;
