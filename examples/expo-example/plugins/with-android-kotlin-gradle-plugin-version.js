const {
  createRunOncePlugin,
  withProjectBuildGradle,
} = require('expo/config-plugins');

const DEFAULT_KOTLIN_VERSION = '2.3.20';

function withAndroidKotlinGradlePluginVersion(config, props = {}) {
  const kotlinVersion = props.version ?? DEFAULT_KOTLIN_VERSION;

  return withProjectBuildGradle(config, (nextConfig) => {
    nextConfig.modResults.contents = nextConfig.modResults.contents.replace(
      /classpath\(['"]org\.jetbrains\.kotlin:kotlin-gradle-plugin(?::[^'"]+)?['"]\)/,
      `classpath('org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}')`
    );
    return nextConfig;
  });
}

module.exports = createRunOncePlugin(
  withAndroidKotlinGradlePluginVersion,
  'with-android-kotlin-gradle-plugin-version',
  '1.0.0'
);
