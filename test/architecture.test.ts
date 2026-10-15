// The lint config is the architecture. These cases prove each rule fires, so a typo in
// eslint.config.mjs cannot quietly switch one off. Each fixture is linted inside a copy of the repo.
import { cp, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { ESLint } from 'eslint';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const repo = path.resolve(import.meta.dirname, '..');

interface Case {
  readonly name: string;
  readonly file: string;
  readonly code: string;
  readonly rule: string | null; // null: the file must lint clean
  readonly css?: string; // written next to the file as <name>.module.css
}

const component = (body: string) =>
  `import styles from './pair.module.css';\n\nexport function Pair() {\n  return ${body};\n}\n`;

const CASES: readonly Case[] = [
  // layers
  {
    name: 'domain may not use react',
    file: 'src/domain/bad-react.ts',
    code: "import { useState } from 'react';\n\nexport const x = useState;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'domain may not use application',
    file: 'src/domain/bad-up.ts',
    code: "import { libraryOf } from '@/application/workspace-library';\n\nexport const x = libraryOf;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'application may not use infrastructure',
    file: 'src/application/bad-infra.ts',
    code: "import { readWorkspaces } from '@/infrastructure/workspace-store';\n\nexport const x = readWorkspaces;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'application may not use node',
    file: 'src/application/bad-node.ts',
    code: "import path from 'node:path';\n\nexport const x = path.sep;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'a feature may not use infrastructure',
    file: 'src/features/workspaces/bad-infra.ts',
    code: "import { readWorkspaces } from '@/infrastructure/workspace-store';\n\nexport const x = readWorkspaces;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'a feature may not use another feature',
    file: 'src/features/other/bad-cross.ts',
    code: "import { WorkspaceLibrary } from '@/features/workspaces';\n\nexport const x = WorkspaceLibrary;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'ui may not know the model',
    file: 'src/ui/bad-model.ts',
    code: "import { systemsOf } from '@/domain/workspace';\n\nexport const x = systemsOf;\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'a route reaches a feature through its index',
    file: 'src/app/bad/page.tsx',
    code: "import { WorkspaceLibrary } from '@/features/workspaces/workspace-library';\n\nexport default function Page() {\n  return <WorkspaceLibrary cards={[]} />;\n}\n",
    rule: 'boundaries/dependencies',
  },
  {
    name: 'a route may use a feature index',
    file: 'src/app/good/page.tsx',
    code: "import { WorkspaceLibrary } from '@/features/workspaces';\n\nexport default function Page() {\n  return <WorkspaceLibrary cards={[]} />;\n}\n",
    rule: null,
  },
  {
    name: 'a file outside the layers',
    file: 'src/misc/stray.ts',
    code: 'export const x = 1;\n',
    rule: 'boundaries/no-unknown-files',
  },
  // Next.js
  {
    name: 'only route files in app',
    file: 'src/app/helpers.ts',
    code: 'export const x = 1;\n',
    rule: 'groundwork/app-route-files-only',
  },
  {
    name: "'use client' needs a .client.tsx name",
    file: 'src/features/workspaces/bad-client.tsx',
    code: "'use client';\n\nexport function A() {\n  return <p>a</p>;\n}\n",
    rule: 'groundwork/client-file-naming',
  },
  {
    name: 'a .client.tsx file is fine',
    file: 'src/features/workspaces/good-thing.client.tsx',
    code: "'use client';\n\nexport function GoodThing() {\n  return <p>a</p>;\n}\n",
    rule: null,
  },
  {
    name: 'no revalidation in a static site',
    file: 'src/app/revalidating/page.tsx',
    code: 'export const revalidate = 60;\n\nexport default function Page() {\n  return <p>a</p>;\n}\n',
    rule: 'groundwork/static-export-only',
  },
  {
    name: 'no inline styles',
    file: 'src/ui/bad-style.tsx',
    code: "export function A() {\n  return <p style={{ color: 'red' }}>a</p>;\n}\n",
    rule: 'react/forbid-dom-props',
  },
  {
    name: 'no plain CSS imports',
    file: 'src/ui/bad-css.ts',
    code: "import './x.css';\n\nexport const x = 1;\n",
    rule: 'no-restricted-imports',
  },
  // CSS modules
  {
    name: 'a class must exist in the module',
    file: 'src/ui/missing/pair.tsx',
    css: '.box {\n  margin: 0;\n}\n',
    code: component('<p className={styles.box + styles.gone}>a</p>'),
    rule: 'groundwork/css-modules',
  },
  {
    name: 'every class in the module is used',
    file: 'src/ui/unused/pair.tsx',
    css: '.box {\n  margin: 0;\n}\n\n.spare {\n  margin: 0;\n}\n',
    code: component('<p className={styles.box}>a</p>'),
    rule: 'groundwork/css-modules',
  },
  {
    name: 'no dynamic class lookups',
    file: 'src/ui/dynamic/pair.tsx',
    css: '.box {\n  margin: 0;\n}\n',
    code: component("<p className={styles[String('box')]}>a</p>"),
    rule: 'groundwork/css-modules',
  },
  {
    name: 'a component imports only its own module',
    file: 'src/ui/stranger/other.tsx',
    css: '.box {\n  margin: 0;\n}\n',
    code: "import styles from './pair.module.css';\n\nexport function Other() {\n  return <p className={styles.box}>a</p>;\n}\n",
    rule: 'groundwork/css-modules',
  },
  {
    name: 'a matching pair is fine',
    file: 'src/ui/good/pair.tsx',
    css: '.box {\n  margin: 0;\n}\n',
    code: component('<p className={styles.box}>a</p>'),
    rule: null,
  },
  // code shape
  {
    name: 'no ../ imports',
    file: 'src/application/bad-parent.ts',
    code: "import { systemsOf } from '../domain/workspace';\n\nexport const x = systemsOf;\n",
    rule: 'no-restricted-imports',
  },
  {
    name: 'no enums',
    file: 'src/domain/bad-enum.ts',
    code: 'export enum Colour {\n  Red,\n}\n',
    rule: 'no-restricted-syntax',
  },
  {
    name: 'no default exports',
    file: 'src/domain/bad-default.ts',
    code: 'const x = 1;\nexport default x;\n',
    rule: 'import/no-default-export',
  },
  {
    name: 'no type assertions',
    file: 'src/domain/bad-cast.ts',
    code: "export const x = JSON.parse('1') as number;\n",
    rule: '@typescript-eslint/consistent-type-assertions',
  },
  {
    name: 'kebab-case file names',
    file: 'src/domain/BadName.ts',
    code: 'export const x = 1;\n',
    rule: 'unicorn/filename-case',
  },
];

let root = '';
const found = new Map<string, readonly string[]>();

beforeAll(async () => {
  root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'groundwork-arch-')));
  for (const entry of ['src', 'eslint', 'eslint.config.mjs', 'tsconfig.json', 'package.json']) {
    await cp(path.join(repo, entry), path.join(root, entry), { recursive: true });
  }
  await symlink(path.join(repo, 'node_modules'), path.join(root, 'node_modules'), 'dir');
  for (const fixture of CASES) {
    await mkdir(path.dirname(path.join(root, fixture.file)), { recursive: true });
    await writeFile(path.join(root, fixture.file), fixture.code);
    if (fixture.css !== undefined) {
      await writeFile(path.join(root, path.dirname(fixture.file), 'pair.module.css'), fixture.css);
    }
  }
  // boundaries reads paths against the process's directory, not ESLint's cwd
  const previous = process.cwd();
  process.chdir(root);
  const eslint = new ESLint({ cwd: root });
  const results = await eslint.lintFiles(CASES.map((fixture) => fixture.file)).finally(() => {
    process.chdir(previous);
  });
  for (const result of results) {
    const rules = result.messages.map((message) => message.ruleId ?? message.message);
    found.set(path.relative(root, result.filePath), rules);
  }
}, 120_000);

afterAll(async () => {
  if (root !== '') await rm(root, { recursive: true, force: true });
});

describe('the lint config enforces the architecture', () => {
  it.each(CASES)('$name', ({ file, rule }) => {
    const rules = found.get(file);
    if (rule === null) expect(rules).toEqual([]);
    else expect(rules).toContain(rule);
  });
});
