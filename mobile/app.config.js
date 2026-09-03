/** Keep the package-installer capability out of Google Play builds. */
module.exports = ({ config }) => {
  const playManaged = process.env.AR_APP_DISTRIBUTION_CHANNEL === 'play';
  const releaseVersion = process.env.AR_APP_RELEASE_VERSION?.trim();
  const releaseVersionCodeRaw = process.env.AR_APP_ANDROID_VERSION_CODE?.trim();
  if (Boolean(releaseVersion) !== Boolean(releaseVersionCodeRaw)) {
    throw new Error(
      'AR_APP_RELEASE_VERSION and AR_APP_ANDROID_VERSION_CODE must be provided together',
    );
  }
  const releaseVersionCode = releaseVersionCodeRaw ? Number(releaseVersionCodeRaw) : null;
  if (releaseVersion && !/^\d+\.\d+\.\d+$/.test(releaseVersion)) {
    throw new Error('AR_APP_RELEASE_VERSION must be a numeric semantic version');
  }
  if (releaseVersionCode != null && (!Number.isInteger(releaseVersionCode) || releaseVersionCode < 1)) {
    throw new Error('AR_APP_ANDROID_VERSION_CODE must be a positive integer');
  }
  const permissions = new Set(config.android?.permissions ?? []);
  if (playManaged) permissions.delete('REQUEST_INSTALL_PACKAGES');
  else permissions.add('REQUEST_INSTALL_PACKAGES');
  return {
    ...config,
    ...(releaseVersion ? { version: releaseVersion } : {}),
    android: {
      ...config.android,
      ...(releaseVersionCode != null ? { versionCode: releaseVersionCode } : {}),
      permissions: [...permissions],
    },
    extra: { ...config.extra, selfUpdateEnabled: !playManaged },
  };
};
