import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';

const rootDir = path.resolve(process.cwd());
const configPath = path.join(rootDir, 'api-docs.config.json');
const outputPath = path.join(rootDir, 'API.md');
const packagePath = path.join(rootDir, 'package.json');
const scriptPath = path.join(rootDir, 'scripts/generate-api.mjs');

function parseJson(contents, filePath) {
  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`Could not parse ${path.relative(rootDir, filePath)}`, {
      cause: error,
    });
  }
}

function validateConfigShape(config) {
  if (!config || !Array.isArray(config.groups) || config.groups.length === 0) {
    throw new Error(
      'api-docs.config.json must define a non-empty groups array'
    );
  }

  for (const [index, group] of config.groups.entries()) {
    if (!group || typeof group.label !== 'string' || group.label.length === 0) {
      throw new Error(`API group ${index + 1} must have a non-empty label`);
    }
    if (
      !Array.isArray(group.symbols) ||
      group.symbols.some(
        (symbolId) => typeof symbolId !== 'string' || symbolId.length === 0
      )
    ) {
      throw new Error(`API group "${group.label}" must contain symbol IDs`);
    }
  }
}

export function validateGroups(groups, publicApiIds) {
  const publicApi = new Set(publicApiIds);
  const assignedSymbols = new Set();
  const duplicateSymbols = new Set();

  for (const group of groups) {
    for (const symbolId of group.symbols) {
      if (assignedSymbols.has(symbolId)) {
        duplicateSymbols.add(symbolId);
      }
      assignedSymbols.add(symbolId);
    }
  }

  const missingSymbols = [...assignedSymbols]
    .filter((symbolId) => !publicApi.has(symbolId))
    .sort();
  const unassignedSymbols = [...publicApi]
    .filter((symbolId) => !assignedSymbols.has(symbolId))
    .sort();
  const failures = [];

  if (duplicateSymbols.size > 0) {
    failures.push(
      `duplicate configured symbol(s): ${[...duplicateSymbols].sort().join(', ')}`
    );
  }
  if (missingSymbols.length > 0) {
    failures.push(`missing configured symbol(s): ${missingSymbols.join(', ')}`);
  }
  if (unassignedSymbols.length > 0) {
    failures.push(
      `unassigned public API ID(s): ${unassignedSymbols.join(', ')}`
    );
  }

  if (failures.length > 0) {
    throw new Error(failures.join('\n'));
  }
}

export function getPackageDeclarationEntries(packageJson) {
  const entries = [
    ['types', packageJson.types],
    ['exports["."].import.types', packageJson.exports?.['.']?.import?.types],
    ['exports["."].require.types', packageJson.exports?.['.']?.require?.types],
  ];

  for (const [field, declarationEntry] of entries) {
    if (typeof declarationEntry !== 'string') {
      throw new Error(
        `package.json must define ${field} as a declaration entry`
      );
    }
  }

  return entries.map(([field, declarationEntry]) => ({
    field,
    declarationEntry,
  }));
}

export function validateDeclarationParity(entries) {
  const [baseline, ...comparisons] = entries;
  if (!baseline) {
    throw new Error('At least one declaration entry is required');
  }

  const baselineDeclarations = [...baseline.declarations.entries()];
  for (const comparison of comparisons) {
    const comparisonDeclarations = [...comparison.declarations.entries()];
    if (
      JSON.stringify(comparisonDeclarations) !==
      JSON.stringify(baselineDeclarations)
    ) {
      throw new Error(
        `Extracted public declarations diverge between package.json ${baseline.field} and ${comparison.field}`
      );
    }
  }
}

function renderableDeclarationNode(declaration) {
  if (ts.isVariableDeclaration(declaration)) {
    return declaration.parent.parent;
  }
  return declaration;
}

function declarationIdentity(declaration) {
  const sourceFile = declaration.getSourceFile();
  return `${sourceFile.fileName}:${declaration.pos}:${declaration.end}`;
}

function publicDeclarationText(
  declaration,
  checker,
  exportedSymbols,
  projectRoot
) {
  if (
    !ts.isInterfaceDeclaration(declaration) &&
    !ts.isTypeAliasDeclaration(declaration)
  ) {
    return declaration.getText(declaration.getSourceFile());
  }

  const sourceFile = declaration.getSourceFile();

  function localSupportSymbol(typeName) {
    let symbol = checker.getSymbolAtLocation(typeName);
    if (symbol?.flags & ts.SymbolFlags.Alias) {
      symbol = checker.getAliasedSymbol(symbol);
    }
    if (
      !symbol ||
      symbol.flags & ts.SymbolFlags.TypeParameter ||
      exportedSymbols.has(symbol)
    ) {
      return undefined;
    }
    const declarations = symbol.declarations ?? [];
    if (declarations.length === 0) {
      return undefined;
    }
    const local = declarations.every((candidate) => {
      const candidatePath = path.resolve(candidate.getSourceFile().fileName);
      return (
        candidatePath.startsWith(`${projectRoot}${path.sep}`) &&
        !candidatePath.includes(`${path.sep}node_modules${path.sep}`)
      );
    });
    return local ? symbol : undefined;
  }

  function publicMemberId(member) {
    if (!member.name) {
      return undefined;
    }
    if (
      ts.isIdentifier(member.name) ||
      ts.isStringLiteral(member.name) ||
      ts.isNumericLiteral(member.name)
    ) {
      return member.name.text;
    }
    return undefined;
  }

  function isHiddenBrandMember(member) {
    return Boolean(
      member.name &&
        ts.isComputedPropertyName(member.name) &&
        localSupportSymbol(member.name.expression)
    );
  }

  function supportTypeNode(symbol, stack, context) {
    if (stack.has(symbol)) {
      throw new Error(
        `Recursive non-exported support type cannot be rendered in ${declaration.name.text}: ${symbol.name}`
      );
    }
    const nextStack = new Set(stack).add(symbol);
    const supportDeclarations = symbol.declarations ?? [];
    const interfaces = supportDeclarations.filter(ts.isInterfaceDeclaration);
    const aliases = supportDeclarations.filter(ts.isTypeAliasDeclaration);

    if (interfaces.length > 0 && aliases.length === 0) {
      if (interfaces.some((candidate) => candidate.typeParameters?.length)) {
        throw new Error(
          `Generic non-exported support interface cannot be rendered in ${declaration.name.text}: ${symbol.name}`
        );
      }
      return ts.factory.createTypeLiteralNode(
        interfaces.flatMap((candidate) =>
          interfaceMembers(candidate, nextStack, context)
        )
      );
    }
    if (aliases.length === 1 && interfaces.length === 0) {
      if (aliases[0].typeParameters?.length) {
        throw new Error(
          `Generic non-exported support alias cannot be rendered in ${declaration.name.text}: ${symbol.name}`
        );
      }
      return visit(aliases[0].type, nextStack, context);
    }
    throw new Error(
      `Unsupported non-exported support declaration in ${declaration.name.text}: ${symbol.name}`
    );
  }

  function interfaceMembers(interfaceDeclaration, stack, context) {
    const inherited = [];
    for (const clause of interfaceDeclaration.heritageClauses ?? []) {
      if (clause.token !== ts.SyntaxKind.ExtendsKeyword) {
        throw new Error(
          `Unsupported support interface heritage in ${interfaceDeclaration.name.text}`
        );
      }
      for (const type of clause.types) {
        const support = localSupportSymbol(type.expression);
        if (!support) {
          throw new Error(
            `Non-exported support interface heritage cannot be preserved in ${declaration.name.text}`
          );
        }
        const expanded = supportTypeNode(support, stack, context);
        if (!ts.isTypeLiteralNode(expanded)) {
          throw new Error(
            `Interface ${interfaceDeclaration.name.text} extends a non-interface support type ${support.name}`
          );
        }
        inherited.push(...expanded.members);
      }
    }

    const own = interfaceDeclaration.members
      .filter(
        (member) => !hasNonPublicModifier(member) && !isHiddenBrandMember(member)
      )
      .map((member) => visit(member, stack, context));
    const ownNames = new Set(own.map(publicMemberId).filter(Boolean));
    return [
      ...inherited.filter((member) => {
        const name = publicMemberId(member);
        return !name || !ownNames.has(name);
      }),
      ...own,
    ];
  }

  function visit(node, stack, context) {
    if (ts.isTypeReferenceNode(node)) {
      const support = localSupportSymbol(node.typeName);
      if (support) {
        if (node.typeArguments?.length) {
          throw new Error(
            `Generic non-exported support reference cannot be rendered in ${declaration.name.text}: ${support.name}`
          );
        }
        return supportTypeNode(support, stack, context);
      }
    }
    if (ts.isTypeLiteralNode(node)) {
      return ts.factory.updateTypeLiteralNode(
        node,
        node.members
          .filter(
            (member) =>
              !hasNonPublicModifier(member) && !isHiddenBrandMember(member)
          )
          .map((member) => visit(member, stack, context))
      );
    }
    return ts.visitEachChild(
      node,
      (child) => visit(child, stack, context),
      context
    );
  }

  const result = ts.transform(declaration, [
    (context) => (root) => {
      if (ts.isInterfaceDeclaration(root)) {
        const members = interfaceMembers(root, new Set(), context);
        const retainedHeritage = (root.heritageClauses ?? [])
          .map((clause) => {
            if (clause.token !== ts.SyntaxKind.ExtendsKeyword) {
              return clause;
            }
            const types = clause.types.filter(
              (type) => !localSupportSymbol(type.expression)
            );
            return types.length > 0
              ? ts.factory.updateHeritageClause(clause, types)
              : undefined;
          })
          .filter(Boolean);
        return ts.factory.updateInterfaceDeclaration(
          root,
          root.modifiers,
          root.name,
          root.typeParameters,
          retainedHeritage,
          members
        );
      }
      return visit(root, new Set(), context);
    },
  ]);
  const transformed = result.transformed[0];
  ts.setEmitFlags(transformed, ts.EmitFlags.NoLeadingComments);
  result.dispose();
  return ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed })
    .printNode(ts.EmitHint.Unspecified, transformed, sourceFile);
}

function hasNonPublicModifier(declaration) {
  const modifierFlags = ts.getCombinedModifierFlags(declaration);
  return Boolean(
    modifierFlags &
    (ts.ModifierFlags.Private |
      ts.ModifierFlags.Protected |
      ts.ModifierFlags.Static)
  );
}

function memberName(member) {
  if (
    !member.name ||
    (!ts.isIdentifier(member.name) &&
      !ts.isStringLiteral(member.name) &&
      !ts.isNumericLiteral(member.name))
  ) {
    throw new Error(
      `Unsupported public client member name: ${member.getText(
        member.getSourceFile()
      )}`
    );
  }

  return member.name.text;
}

function getClassDeclarations(type) {
  const symbol = type.aliasSymbol ?? type.getSymbol();
  return (symbol?.declarations ?? []).filter(ts.isClassDeclaration);
}

function discoverPublicClientMembers(exportedClassDeclarations, checker) {
  const membersById = new Map();

  for (const exportedClass of exportedClassDeclarations.filter(
    ts.isClassDeclaration
  )) {
    for (const property of exportedClass.members.filter(
      ts.isPropertyDeclaration
    )) {
      if (hasNonPublicModifier(property) || !property.type) {
        continue;
      }

      const clientClasses = getClassDeclarations(
        checker.getTypeFromTypeNode(property.type)
      );
      if (clientClasses.length === 0) {
        continue;
      }

      const propertyName = memberName(property);
      for (const clientClass of clientClasses) {
        if (!clientClass.name) {
          throw new Error(
            `Public client exposed by ${propertyName} must have a class name`
          );
        }
        const clientClassName = clientClass.name.text;

        for (const clientMember of clientClass.members) {
          if (
            ts.isConstructorDeclaration(clientMember) ||
            hasNonPublicModifier(clientMember)
          ) {
            continue;
          }

          const clientMemberName = memberName(clientMember);
          const id = `${clientClassName}.${clientMemberName}`;
          const existing = membersById.get(id) ?? {
            declarations: [],
            summary: '',
          };
          const identity = declarationIdentity(clientMember);

          if (
            !existing.declarations.some(
              (declaration) => declarationIdentity(declaration) === identity
            )
          ) {
            existing.declarations.push(clientMember);
          }

          if (!existing.summary) {
            const symbol = checker.getSymbolAtLocation(clientMember.name);
            existing.summary = symbol
              ? ts
                  .displayPartsToString(symbol.getDocumentationComment(checker))
                  .trim()
              : '';
          }

          membersById.set(id, existing);
        }
      }
    }
  }

  return new Map(
    [...membersById].map(([id, member]) => [
      id,
      {
        declarationText: member.declarations
          .map((declaration) =>
            declaration.getText(declaration.getSourceFile())
          )
          .join('\n'),
        summary: member.summary,
      },
    ])
  );
}

export function getPublicDeclarations(declarationEntryPath) {
  const program = ts.createProgram([declarationEntryPath], {
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
  });
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(declarationEntryPath);

  if (!sourceFile) {
    throw new Error(
      `TypeScript did not load ${path.relative(rootDir, declarationEntryPath)}`
    );
  }

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    throw new Error('The package declaration entry is not an external module');
  }

  const exportedEntries = checker.getExportsOfModule(moduleSymbol).map(
    (exportedSymbol) => ({
      exportedSymbol,
      symbol:
        exportedSymbol.flags & ts.SymbolFlags.Alias
          ? checker.getAliasedSymbol(exportedSymbol)
          : exportedSymbol,
    })
  );
  const exportedSymbols = new Set(exportedEntries.map(({ symbol }) => symbol));
  const declarations = new Map();
  const exportedClasses = [];
  for (const { exportedSymbol, symbol } of exportedEntries) {
    const symbolDeclarations = symbol.declarations ?? [];
    const renderableDeclarations = [];
    const seenDeclarations = new Set();

    for (const declaration of symbolDeclarations) {
      const renderableDeclaration = renderableDeclarationNode(declaration);
      if (!renderableDeclaration.getSourceFile().isDeclarationFile) {
        continue;
      }

      const identity = declarationIdentity(renderableDeclaration);
      if (!seenDeclarations.has(identity)) {
        seenDeclarations.add(identity);
        renderableDeclarations.push(renderableDeclaration);
      }
    }

    if (renderableDeclarations.length === 0) {
      throw new Error(
        `Could not resolve declaration for public export ${exportedSymbol.name}`
      );
    }

    const summary = ts
      .displayPartsToString(symbol.getDocumentationComment(checker))
      .trim();
    const declarationText = renderableDeclarations
      .map((declaration) =>
        publicDeclarationText(
          declaration,
          checker,
          exportedSymbols,
          path.dirname(declarationEntryPath)
        )
      )
      .join('\n');

    declarations.set(exportedSymbol.name, { declarationText, summary });

    if (renderableDeclarations.some(ts.isClassDeclaration)) {
      exportedClasses.push(renderableDeclarations);
    }
  }

  for (const exportedClassDeclarations of exportedClasses) {
    const clientMembers = discoverPublicClientMembers(
      exportedClassDeclarations,
      checker
    );
    for (const [id, member] of clientMembers) {
      if (declarations.has(id)) {
        throw new Error(`Duplicate public API ID discovered: ${id}`);
      }
      declarations.set(id, member);
    }
  }

  return declarations;
}

function renderApi(groups, declarations) {
  const lines = [
    '<!-- Generated by scripts/generate-api.mjs. Do not edit directly. -->',
    '',
    '# React Native API reference',
    '',
  ];

  for (const group of groups) {
    lines.push(`## ${group.label}`, '');

    for (const symbolId of group.symbols) {
      const declaration = declarations.get(symbolId);
      lines.push(`### \`${symbolId}\``, '');

      if (declaration.summary) {
        lines.push(declaration.summary, '');
      }

      lines.push('```ts', declaration.declarationText, '```', '');
    }
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

async function main() {
  const check = process.argv.slice(2).includes('--check');
  const unknownArguments = process.argv
    .slice(2)
    .filter((argument) => argument !== '--check');
  if (unknownArguments.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArguments.join(', ')}`);
  }

  const [packageContents, configContents] = await Promise.all([
    readFile(packagePath, 'utf8'),
    readFile(configPath, 'utf8'),
  ]);
  const packageJson = parseJson(packageContents, packagePath);
  const config = parseJson(configContents, configPath);
  validateConfigShape(config);

  const declarationEntries = getPackageDeclarationEntries(packageJson).map(
    ({ field, declarationEntry }) => ({
      field,
      declarationEntry,
      declarations: getPublicDeclarations(
        path.resolve(rootDir, declarationEntry)
      ),
    })
  );
  validateDeclarationParity(declarationEntries);
  const declarations = declarationEntries[0].declarations;
  validateGroups(config.groups, declarations.keys());
  const output = renderApi(config.groups, declarations);

  if (check) {
    const currentOutput = await readFile(outputPath, 'utf8');
    if (currentOutput !== output) {
      throw new Error('API.md is out of date. Run `yarn generate:api`.');
    }
    process.stdout.write(
      `API.md is current (${declarations.size} public API IDs).\n`
    );
    return;
  }

  await writeFile(outputPath, output);
  process.stdout.write(
    `Generated API.md from ${declarationEntries.length} matching declaration entries (${declarations.size} public API IDs).\n`
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
