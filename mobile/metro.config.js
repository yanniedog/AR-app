const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const NOBLE_HASHES_CRYPTO = '@noble/hashes/crypto';

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName !== NOBLE_HASHES_CRYPTO) {
    return context.resolveRequest(context, moduleName, platform);
  }

  // @noble/hashes@1.8 exposes this public subpath, but its legacy browser map
  // redirects it to the physical `./crypto.js` file before Metro evaluates
  // package exports. Metro then warns because that physical subpath is not
  // separately exported. Skip only that legacy redirect; exports resolution
  // remains enabled for this request and every other package.
  return context.resolveRequest(
    {
      ...context,
      mainFields: context.mainFields.filter((field) => field !== 'browser'),
    },
    moduleName,
    platform,
  );
};

module.exports = config;
