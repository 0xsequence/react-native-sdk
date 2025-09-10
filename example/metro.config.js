const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');

const root = path.resolve(__dirname, '..');

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
module.exports = (async () => {
  // Dynamically import the ESM package
  const { withMetroConfig } = await import('react-native-monorepo-config');

  // Get the default config from Expo
  const defaultConfig = getDefaultConfig(__dirname);

  // Apply the monorepo configuration
  const config = withMetroConfig(defaultConfig, {
    root,
    dirname: __dirname,
  });

  // Apply your custom resolver setting
  config.resolver.unstable_enablePackageExports = true;

  // Return the final configuration object
  return config;
})();
