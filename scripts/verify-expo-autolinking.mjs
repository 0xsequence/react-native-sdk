import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exampleDir = path.join(rootDir, 'examples', 'expo-example');
const executable = path.join(
  exampleDir,
  'node_modules',
  '.bin',
  'expo-modules-autolinking'
);
const packageName = '@polygonlabs/oms-wallet-react-native';

for (const platform of ['android', 'ios']) {
  const result = spawnSync(
    executable,
    ['react-native-config', '--platform', platform, '--json'],
    { cwd: exampleDir, encoding: 'utf8' }
  );

  if (result.error != null) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }

  const config = JSON.parse(result.stdout);
  if (config.dependencies?.[packageName]?.platforms?.[platform] == null) {
    throw new Error(`${packageName} was not autolinked for ${platform}`);
  }
}
