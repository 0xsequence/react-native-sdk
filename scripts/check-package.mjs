import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'yarn',
  ['npm', 'publish', '--dry-run', '--access', 'public', '--json'],
  {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    env: {
      ...process.env,
      YARN_NPM_PUBLISH_PROVENANCE: 'false',
    },
    shell: false,
  }
);

if (result.status !== 0) {
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

const records = result.stdout
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const summary = records.find(
  (record) => Array.isArray(record.files) && record.dryRun === true
);

if (!summary) {
  throw new Error('Yarn publish dry-run did not return a package summary');
}

const files = new Set(summary.files);
const requiredFiles = [
  'API.md',
  'CHANGELOG.md',
  'LICENSE',
  'OmsWalletReactNativeSdk.podspec',
  'README.md',
  'android/build.gradle',
  'android/src/main/AndroidManifest.xml',
  'android/src/main/java/com/omswalletreactnativesdk/OmsWalletReactNativeSdkModule.kt',
  'ios/OmsWalletReactNativeSdk.h',
  'ios/OmsWalletReactNativeSdk.mm',
  'ios/OmsWalletReactNativeSdkImpl.swift',
  'lib/commonjs/index.js',
  'lib/module/index.js',
  'lib/typescript/commonjs/src/index.d.ts',
  'lib/typescript/module/src/index.d.ts',
  'package.json',
  'src/index.tsx',
];
const missingFiles = requiredFiles.filter((file) => !files.has(file));

const forbiddenPrefixes = [
  '.github/',
  'examples/',
  'node_modules/',
  'scripts/',
  'test/',
  'android/build/',
  'ios/build/',
];
const forbiddenFiles = [...files].filter((file) =>
  forbiddenPrefixes.some((prefix) => file.startsWith(prefix))
);

if (missingFiles.length > 0 || forbiddenFiles.length > 0) {
  const failures = [];
  if (missingFiles.length > 0) {
    failures.push(`missing required file(s): ${missingFiles.join(', ')}`);
  }
  if (forbiddenFiles.length > 0) {
    failures.push(`included forbidden file(s): ${forbiddenFiles.join(', ')}`);
  }
  throw new Error(failures.join('\n'));
}

process.stdout.write(
  `Package dry-run is valid (${summary.files.length} files, ${summary.name}@${summary.version}).\n`
);
