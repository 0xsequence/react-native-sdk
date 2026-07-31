import { readFile } from 'node:fs/promises';

const [androidBuild, podspec] = await Promise.all([
  readFile(new URL('../android/build.gradle', import.meta.url), 'utf8'),
  readFile(
    new URL('../OmsWalletReactNativeSdk.podspec', import.meta.url),
    'utf8'
  ),
]);

function requireVersion(contents, pattern, label) {
  const match = contents.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Could not find ${label} dependency version`);
  }
  return match[1];
}

const kotlinVersion = requireVersion(
  androidBuild,
  /omsWalletKotlinSdkVersion:\s*"([^"]+)"/,
  'Kotlin SDK'
);
const swiftVersion = requireVersion(
  podspec,
  /s\.dependency\s+"oms-wallet-swift-sdk",\s+"([^"]+)"/,
  'Swift SDK'
);

if (kotlinVersion !== swiftVersion) {
  throw new Error(
    `Native SDK dependency versions diverge: Kotlin ${kotlinVersion}, Swift ${swiftVersion}`
  );
}

process.stdout.write(
  `Native SDK dependency versions match (${kotlinVersion}).\n`
);
