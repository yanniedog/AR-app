/** Keep the package-installer capability out of Google Play builds. */
module.exports = ({ config }) => {
  const playManaged = process.env.AR_APP_DISTRIBUTION_CHANNEL === 'play';
  const permissions = new Set(config.android?.permissions ?? []);
  if (playManaged) permissions.delete('REQUEST_INSTALL_PACKAGES');
  else permissions.add('REQUEST_INSTALL_PACKAGES');
  return {
    ...config,
    android: { ...config.android, permissions: [...permissions] },
    extra: { ...config.extra, selfUpdateEnabled: !playManaged },
  };
};
