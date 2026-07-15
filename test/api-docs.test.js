const assert = require('node:assert/strict');
const { mkdtemp, rm, writeFile } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const generatorModule = import('../scripts/generate-api.mjs');

test('rejects public API IDs that have no configured group', async () => {
  const { validateGroups } = await generatorModule;

  assert.throws(
    () =>
      validateGroups(
        [{ label: 'Group', symbols: ['Configured'] }],
        ['Configured', 'NewExport']
      ),
    /unassigned public API ID\(s\): NewExport/
  );
});

test('rejects configured symbols that are not public exports', async () => {
  const { validateGroups } = await generatorModule;

  assert.throws(
    () =>
      validateGroups(
        [{ label: 'Group', symbols: ['RemovedExport'] }],
        ['PublicExport']
      ),
    /missing configured symbol\(s\): RemovedExport/
  );
});

test('rejects symbols assigned to more than one group', async () => {
  const { validateGroups } = await generatorModule;

  assert.throws(
    () =>
      validateGroups(
        [
          { label: 'First', symbols: ['PublicExport'] },
          { label: 'Second', symbols: ['PublicExport'] },
        ],
        ['PublicExport']
      ),
    /duplicate configured symbol\(s\): PublicExport/
  );
});

test('requires every public package declaration entry', async () => {
  const { getPackageDeclarationEntries } = await generatorModule;
  const packageJson = {
    types: './types.d.ts',
    exports: {
      '.': {
        import: { types: './import.d.ts' },
        require: { types: './require.d.ts' },
      },
    },
  };

  assert.deepEqual(getPackageDeclarationEntries(packageJson), [
    { field: 'types', declarationEntry: './types.d.ts' },
    {
      field: 'exports["."].import.types',
      declarationEntry: './import.d.ts',
    },
    {
      field: 'exports["."].require.types',
      declarationEntry: './require.d.ts',
    },
  ]);

  for (const [field, mutate] of [
    ['types', (value) => delete value.types],
    [
      'exports["."].import.types',
      (value) => delete value.exports['.'].import.types,
    ],
    [
      'exports["."].require.types',
      (value) => delete value.exports['.'].require.types,
    ],
  ]) {
    const incomplete = JSON.parse(JSON.stringify(packageJson));
    mutate(incomplete);
    assert.throws(() => getPackageDeclarationEntries(incomplete), {
      message: `package.json must define ${field} as a declaration entry`,
    });
  }
});

test('rejects divergent declarations across package entries', async () => {
  const { validateDeclarationParity } = await generatorModule;
  const declaration = {
    declarationText: 'export type Value = string;',
    summary: 'A value.',
  };

  assert.doesNotThrow(() =>
    validateDeclarationParity([
      { field: 'types', declarations: new Map([['Value', declaration]]) },
      {
        field: 'exports["."].import.types',
        declarations: new Map([['Value', declaration]]),
      },
      {
        field: 'exports["."].require.types',
        declarations: new Map([['Value', declaration]]),
      },
    ])
  );

  assert.throws(
    () =>
      validateDeclarationParity([
        { field: 'types', declarations: new Map([['Value', declaration]]) },
        {
          field: 'exports["."].import.types',
          declarations: new Map([
            [
              'Value',
              {
                ...declaration,
                declarationText: 'export type Value = number;',
              },
            ],
          ]),
        },
      ]),
    /diverge between package\.json types and exports\["\."\]\.import\.types/
  );
});

test('keeps client member overloads under one public API ID', async (t) => {
  const { getPublicDeclarations } = await generatorModule;
  const fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'api-docs-'));
  t.after(() => rm(fixtureDir, { force: true, recursive: true }));

  const entryPath = path.join(fixtureDir, 'index.d.ts');
  await Promise.all([
    writeFile(entryPath, "export { Root } from './client';\n"),
    writeFile(
      path.join(fixtureDir, 'client.d.ts'),
      [
        'export declare class Root {',
        '    readonly client: Client;',
        '}',
        'export declare class Client {',
        '    run(value: string): string;',
        '    run(value: number): number;',
        '}',
        '',
      ].join('\n')
    ),
  ]);

  const declarations = getPublicDeclarations(entryPath);

  assert.deepEqual([...declarations.keys()], ['Root', 'Client.run']);
  assert.equal(
    declarations.get('Client.run').declarationText,
    ['run(value: string): string;', 'run(value: number): number;'].join('\n')
  );
});

test('inlines private support types and omits private brand properties', async (t) => {
  const { getPublicDeclarations } = await generatorModule;
  const fixtureDir = await mkdtemp(path.join(os.tmpdir(), 'api-docs-'));
  t.after(() => rm(fixtureDir, { force: true, recursive: true }));

  const entryPath = path.join(fixtureDir, 'index.d.ts');
  await Promise.all([
    writeFile(
      entryPath,
      "export type { Network, StartParams } from './types';\n"
    ),
    writeFile(
      path.join(fixtureDir, 'types.d.ts'),
      [
        'declare const brand: unique symbol;',
        'type BaseParams = { walletType?: string; sessionLifetimeSeconds?: number };',
        '/** An opaque registry value from Networks; object literals are invalid. */',
        'export interface Network {',
        '    readonly id: number;',
        '    readonly [brand]: true;',
        '}',
        'export type StartParams = BaseParams & { provider: string };',
        '',
      ].join('\n')
    ),
  ]);

  const declarations = getPublicDeclarations(entryPath);

  assert.deepEqual([...declarations.keys()], ['Network', 'StartParams']);
  assert.equal(
    declarations.get('Network').summary,
    'An opaque registry value from Networks; object literals are invalid.'
  );
  assert.doesNotMatch(
    declarations.get('Network').declarationText,
    /opaque registry/
  );
  assert.doesNotMatch(declarations.get('Network').declarationText, /brand/);
  assert.doesNotMatch(
    declarations.get('StartParams').declarationText,
    /BaseParams/
  );
  assert.match(
    declarations.get('StartParams').declarationText,
    /walletType\?: string/
  );
  assert.match(
    declarations.get('StartParams').declarationText,
    /sessionLifetimeSeconds\?: number/
  );
});
