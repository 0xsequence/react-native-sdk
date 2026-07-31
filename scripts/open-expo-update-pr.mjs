import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const packageName = '@polygonlabs/oms-wallet-react-native';
const token = requireEnv('GITHUB_TOKEN');
const repository = requireEnv('GITHUB_REPOSITORY');
const baseCommit = requireEnv('GITHUB_SHA');
const publishedPackages = JSON.parse(requireEnv('PUBLISHED_PACKAGES'));
const publishedPackage = publishedPackages.find(
  (candidate) => candidate.name === packageName
);

if (!publishedPackage) {
  throw new Error(`${packageName} was not present in publishedPackages`);
}

const rootPackage = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8')
);
if (rootPackage.version !== publishedPackage.version) {
  throw new Error(
    `Published version ${publishedPackage.version} does not match package.json ${rootPackage.version}`
  );
}

run('yarn', ['expo-example:install:published']);
run('npm', ['--prefix', 'examples/expo-example', 'run', 'typecheck']);
run('yarn', ['expo-example:prebuild']);
run('yarn', ['expo-example:verify-autolinking']);

const version = publishedPackage.version;
const branch = `update-expo-example-v${version}`;
const [owner] = repository.split('/');
const existingPulls = await github(
  `/repos/${repository}/pulls?state=open&head=${encodeURIComponent(`${owner}:${branch}`)}`
);
if (existingPulls.length > 0) {
  process.stdout.write(
    `Expo update pull request already exists: ${existingPulls[0].html_url}\n`
  );
  process.exit(0);
}

await github(`/repos/${repository}/git/refs`, {
  method: 'POST',
  body: {
    ref: `refs/heads/${branch}`,
    sha: baseCommit,
  },
});

const paths = [
  'examples/expo-example/package.json',
  'examples/expo-example/package-lock.json',
];
for (const path of paths) {
  const existing = await github(
    `/repos/${repository}/contents/${path}?ref=${encodeURIComponent(baseCommit)}`
  );
  const contents = await readFile(new URL(`../${path}`, import.meta.url));
  await github(`/repos/${repository}/contents/${path}`, {
    method: 'PUT',
    body: {
      message: `chore(expo-example): use SDK v${version}`,
      content: contents.toString('base64'),
      branch,
      sha: existing.sha,
    },
  });
}

const pullRequest = await github(`/repos/${repository}/pulls`, {
  method: 'POST',
  body: {
    title: `chore(expo-example): use SDK v${version}`,
    head: branch,
    base: 'master',
    body: [
      `Updates the standalone Expo example to the registry-published ${packageName}@${version}.`,
      '',
      'Verified before opening this pull request:',
      '',
      '- Expo TypeScript check',
      '- Clean Expo prebuild',
      '- Android and iOS native autolinking',
    ].join('\n'),
  },
});

process.stdout.write(
  `Opened Expo update pull request: ${pullRequest.html_url}\n`
);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    throw new Error(
      `GitHub API ${options.method ?? 'GET'} ${path} failed (${response.status}): ${await response.text()}`
    );
  }
  return response.status === 204 ? undefined : response.json();
}
