import { describe, expect, it, vi } from 'vitest';

import { generatedActionBundles } from './scan-repository-generated';
import type { RepositoryFile } from './scan-repository-inventory';

vi.mock(import('server-only'), () => ({}));

// Exact pinned CDLS declarations, commit 75e70a353571b6ae78475636fe0e0056e5a7c2db.
const declarations: Readonly<Record<string, string>> = {
  '.github/actions/deprecation-check/action.yml':
    "name: 'deprecation-check'\ndescription: |\n  'Check changed files for uses of \"deprecated-packages\"'\n  'Requires the \"changed-files\" action to be run before this action and env.CHANGED_FILES_PATH to be set to point to the json files.'\ninputs:\n  deprecated-packages:\n    description: 'List of patterns to check for in changed files.'\n    required: true\nruns:\n  using: 'node24'\n  main: 'dist/index.mjs'\n",
  '.github/actions/deprecation-check/package.json':
    '{\n  "name": "@vcc-www/deprecation-check-action",\n  "private": true,\n  "type": "module",\n  "version": "1.0.0",\n  "scripts": {\n    "build": "rimraf dist && rolldown -c",\n    "precommit": "yarn run build && git add ./dist",\n    "start": "node ./src/main.mjs",\n    "test": "vitest"\n  },\n  "exports": {\n    ".": "./dist/index.js"\n  },\n  "dependencies": {\n    "@actions/core": "^3.0.0",\n    "@actions/github": "^9.1.1",\n    "@babel/parser": "7.29.7",\n    "@babel/traverse": "7.29.7",\n    "execa": "^9.5.1",\n    "yaml": "^2.7.1"\n  },\n  "devDependencies": {\n    "rimraf": "6.0.1",\n    "rolldown": "^1.0.0-rc.18",\n    "vitest": "4.1.8"\n  }\n}\n',
  '.github/actions/deprecation-check/rolldown.config.mjs':
    "import { createActionConfig } from '../rolldown.config.mjs';\n\nexport default createActionConfig([\n  { input: 'src/main.mjs', file: 'dist/index.mjs' },\n]);\n",
  '.github/actions/rolldown.config.mjs':
    "import { defineConfig } from 'rolldown';\n\n/**\n * @param {Array<{ input: string, file: string }>} entries\n */\nexport function createActionConfig(entries) {\n  return defineConfig(\n    entries.map(({ input, file }) => ({\n      input,\n      platform: 'node',\n      output: { file, format: 'esm' },\n    })),\n  );\n}\n",
  '.github/actions/deprecation-check/src/main.mjs':
    "// @ts-check\nimport { readFile } from 'node:fs/promises';\nimport { getMultilineInput } from '@actions/core';\nimport { checkLegacyPackageUsage } from './checks.mjs';\n\nconst deprecatedPackages = getMultilineInput('deprecated-packages', {\n  required: true,\n});\n\nconst changedFilesContent = await readFile(\n  process.env.CHANGED_FILES_PATH || './changed-files.json',\n  {\n    encoding: 'utf-8',\n  },\n);\n/** @type {import('./checks.mjs').ChangedPackagesCI[]} */\nconst changedFiles = JSON.parse(changedFilesContent);\n\nawait checkLegacyPackageUsage(changedFiles, deprecatedPackages);\n",
};
const bundle = '.github/actions/deprecation-check/dist/index.mjs';
function inventory(contents: Readonly<Record<string, string>>) {
  const files: RepositoryFile[] = Object.keys(contents).map((filename) => ({
    path: filename,
    blob: filename,
    mode: '100644',
    kind: 'blob',
    category: 'source',
    language: 'javascript',
    selectedForParsing: true,
    reason: 'original',
  }));
  return generatedActionBundles({
    files,
    read: (blob, sizeOnly) =>
      Buffer.from(
        sizeOnly ? String(Buffer.byteLength(contents[blob] ?? '')) : (contents[blob] ?? ''),
      ),
  });
}
function selected(contents: Readonly<Record<string, string>>) {
  return inventory({ ...contents, [bundle]: 'bundled runtime' }).find(
    (file) => file.path === bundle,
  );
}
describe('pinned generated action recipe', () => {
  it('retains denominator and original source for the actual CDLS recipe', () => {
    const files = inventory({ ...declarations, [bundle]: 'bundled runtime' });
    expect(files).toHaveLength(6);
    expect(files.find((file) => file.path === bundle)).toMatchObject({
      category: 'ancillary',
      language: null,
      selectedForParsing: false,
    });
    expect(files.find((file) => file.path === bundle)?.reason).toContain('src/main.mjs@');
    expect(files.find((file) => file.path.endsWith('/src/main.mjs'))?.selectedForParsing).toBe(
      true,
    );
  });
  it.each(Object.keys(declarations))('requires each proof file: %s', (removed) => {
    expect(
      selected(
        Object.fromEntries(
          Object.entries(declarations).filter(([filename]) => filename !== removed),
        ),
      )?.selectedForParsing,
    ).toBe(true);
  });
  it.each([
    ['.github/actions/deprecation-check/action.yml', 'runs: {using: node24, main: dist/other.mjs}'],
    [
      '.github/actions/deprecation-check/package.json',
      '{"scripts":{"build":"cp handwritten dist/index.mjs"},"devDependencies":{"rolldown":"1"}}',
    ],
    [
      '.github/actions/deprecation-check/rolldown.config.mjs',
      "import { createActionConfig } from '../rolldown.config.mjs'; export default createActionConfig([{input:'src/main.mjs',file:'dist/other.mjs'}]);",
    ],
    ['.github/actions/rolldown.config.mjs', 'export function createActionConfig() { return {}; }'],
    ['.github/actions/deprecation-check/package.json', '{invalid'],
    ['.github/actions/deprecation-check/action.yml', 'x'.repeat(65_537)],
    [
      '.github/actions/deprecation-check/rolldown.config.mjs',
      "import { createActionConfig } from '../rolldown.config.mjs'; export default createActionConfig([{input:'s rc/main.mjs',file:'dist/index.mjs'}]);",
    ],
  ])('rejects unsupported metadata: %s', (filename, text) => {
    expect(selected({ ...declarations, [filename]: text })?.selectedForParsing).toBe(true);
  });
  it('keeps handwritten dist outside supported action layout selected', () => {
    expect(inventory({ 'dist/index.mjs': 'handwritten' })[0]?.selectedForParsing).toBe(true);
  });
});

const variants = [
  {
    name: 'lint-pr-title',
    contents: {
      '.github/actions/lint-pr-title/action.yml':
        "name: 'lint-pr-title-action'\ndescription: 'Checks that pull request title matches a regular expression based on labels set by actions/labeler@v4'\ninputs:\n  github_token:\n    description: 'github token'\n    required: true\n  labeler_config_path:\n    description: 'Path to the labeler config file'\n    required: true\nruns:\n  using: 'node24'\n  main: 'dist/index.mjs'\n",
      '.github/actions/lint-pr-title/package.json':
        '{\n  "name": "@vcc-www/lint-pr-title",\n  "private": true,\n  "type": "module",\n  "version": "1.0.0",\n  "description": "Checks pull request title matches a predefined regular expression based on labels",\n  "main": "main.mjs",\n  "scripts": {\n    "build": "rimraf dist && rolldown -c",\n    "precommit": "yarn run build && git add ./dist",\n    "start": "node ./main.mjs"\n  },\n  "dependencies": {\n    "@actions/core": "^3.0.0",\n    "@actions/github": "^9.1.1",\n    "yaml": "^2.7.1"\n  },\n  "devDependencies": {\n    "rimraf": "6.0.1",\n    "rolldown": "^1.0.0-rc.18"\n  }\n}\n',
      '.github/actions/lint-pr-title/rolldown.config.mjs':
        "import { createActionConfig } from '../rolldown.config.mjs';\n\nexport default createActionConfig([\n  { input: 'main.mjs', file: 'dist/index.mjs' },\n]);\n",
      '.github/actions/rolldown.config.mjs':
        "import { defineConfig } from 'rolldown';\n\n/**\n * @param {Array<{ input: string, file: string }>} entries\n */\nexport function createActionConfig(entries) {\n  return defineConfig(\n    entries.map(({ input, file }) => ({\n      input,\n      platform: 'node',\n      output: { file, format: 'esm' },\n    })),\n  );\n}\n",
      '.github/actions/lint-pr-title/main.mjs': 'export const original = true;',
      '.github/actions/lint-pr-title/dist/index.mjs': 'bundled runtime',
    },
    outputs: ['.github/actions/lint-pr-title/dist/index.mjs'],
    sources: ['.github/actions/lint-pr-title/main.mjs'],
  },
  {
    name: 'matrix-action',
    contents: {
      '.github/actions/matrix-action/action.yml':
        "name: 'matrix-action'\ndescription: |\n  Generates a matrix of applications to verify based on changed files in a PR and outputs the app specific configuration based on the configuration file provided\n  Only include apps that are affected by the changes in the PR and have a configuration in the configuration file\ninputs:\n  config-file:\n    description: |\n      Path to the json configuration file\n      Should be an object with the application paths as keys, with the value being any object\n    required: true\n  use-paths:\n    description: 'Use file patterns glob matching from config-file instead of detecting any app changes'\n    required: false\n    default: 'false'\n  only-apps:\n    description: 'To only trigger on changes made to /apps'\n    required: false\n    default: 'false'\n  exclude:\n    description: 'A list of paths to exclude from the matrix'\n    required: false\n\noutputs:\n  apps:\n    description: 'A list of all apps who has changes affecting them. Each element is an object of the format {name: string, path: string, config: Object, componentName: string}'\nruns:\n  using: 'node24'\n  main: 'dist/index.mjs'\n",
      '.github/actions/matrix-action/package.json':
        '{\n  "name": "matrix-action",\n  "private": true,\n  "type": "module",\n  "main": "main.mjs",\n  "scripts": {\n    "build": "rimraf dist && rolldown -c",\n    "precommit": "yarn run build && git add ./dist",\n    "start": "node ./src/main.mjs",\n    "test": "vitest"\n  },\n  "dependencies": {\n    "@actions/core": "^3.0.0",\n    "execa": "^9.5.1",\n    "glob": "^11.0.1",\n    "minimatch": "^10.0.1",\n    "parse-diff": "^0.11.1",\n    "yaml": "^2.7.1"\n  },\n  "devDependencies": {\n    "rimraf": "6.0.1",\n    "rolldown": "^1.0.0-rc.18",\n    "vitest": "4.1.8"\n  }\n}\n',
      '.github/actions/matrix-action/rolldown.config.mjs':
        "import { createActionConfig } from '../rolldown.config.mjs';\n\nexport default createActionConfig([\n  { input: 'src/main.mjs', file: 'dist/index.mjs' },\n  {\n    input: 'src/dependency-matrix.mjs',\n    file: 'dist/dependency-matrix/index.mjs',\n  },\n]);\n",
      '.github/actions/rolldown.config.mjs':
        "import { defineConfig } from 'rolldown';\n\n/**\n * @param {Array<{ input: string, file: string }>} entries\n */\nexport function createActionConfig(entries) {\n  return defineConfig(\n    entries.map(({ input, file }) => ({\n      input,\n      platform: 'node',\n      output: { file, format: 'esm' },\n    })),\n  );\n}\n",
      '.github/actions/matrix-action/src/main.mjs': 'export const original = true;',
      '.github/actions/matrix-action/src/dependency-matrix.mjs': 'export const original = true;',
      '.github/actions/matrix-action/dist/index.mjs': 'bundled runtime',
      '.github/actions/matrix-action/dist/dependency-matrix/index.mjs': 'bundled runtime',
    },
    outputs: [
      '.github/actions/matrix-action/dist/index.mjs',
      '.github/actions/matrix-action/dist/dependency-matrix/index.mjs',
    ],
    sources: [
      '.github/actions/matrix-action/src/main.mjs',
      '.github/actions/matrix-action/src/dependency-matrix.mjs',
    ],
  },
];
describe('actual selected CDLS static build variants', () => {
  it.each(variants)(
    'classifies every configured $name output and retains original inputs',
    (variant) => {
      const files = inventory(variant.contents);
      expect(files).toHaveLength(Object.keys(variant.contents).length);
      expect(files.filter((file) => !file.selectedForParsing).map((file) => file.path)).toEqual(
        variant.outputs,
      );
      expect(
        files
          .filter((file) => variant.sources.includes(file.path))
          .every((file) => file.selectedForParsing),
      ).toBe(true);
    },
  );
  it('keeps all outputs selected when one original input is absent', () => {
    const variant = variants[1]!;
    const contents = Object.fromEntries(
      Object.entries(variant.contents).filter(
        ([filename]) => !filename.endsWith('/src/dependency-matrix.mjs'),
      ),
    );
    expect(
      inventory(contents)
        .filter((file) => variant.outputs.includes(file.path))
        .every((file) => file.selectedForParsing),
    ).toBe(true);
  });
});
