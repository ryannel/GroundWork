// The lint rules are the architecture, written down where it is checked. docs/architecture.md explains each layer.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

import groundwork from './eslint/groundwork-plugin.mjs';

const SRC = 'src/**/*.{ts,tsx}';
const TESTS = ['**/*.test.{ts,tsx}', 'test/**/*.{ts,tsx}'];
const CONFIGS = ['*.config.{ts,mjs,js}', 'eslint/**/*.mjs'];

/* ───────── layers ─────────
   domain          the model and its rules. Pure: no React, no Next, no Node, no packages.
   application     what the app works out from the model (use cases, view models). Pure.
   infrastructure  reading and writing the world: files, YAML, git, GitHub. Node. Server only.
   features/<f>    the screens of one feature, in React. Reads application and domain; renders with ui.
   ui              the design system: presentational React, no knowledge of the model.
   shared          small helpers any layer may use (text, dates, collections). Pure.
   app             Next.js routes: load with infrastructure, compute with application, render a feature.
   tools           command-line tools: infrastructure + application, run with node. */
const ELEMENTS = [
  { type: 'app', pattern: 'src/app' },
  { type: 'feature', pattern: 'src/features/*', capture: ['feature'] },
  { type: 'ui', pattern: 'src/ui' },
  { type: 'application', pattern: 'src/application' },
  { type: 'domain', pattern: 'src/domain' },
  { type: 'infrastructure', pattern: 'src/infrastructure' },
  { type: 'shared', pattern: 'src/shared' },
  { type: 'tools', pattern: 'tools' },
];

// (no-restricted-syntax is replaced, not merged, by a later block: both blocks spread this)
const PLAIN_TS = [
  { selector: 'TSEnumDeclaration', message: 'Use a union of string literals, not an enum.' },
  { selector: 'TSModuleDeclaration[kind="namespace"]', message: 'Use modules, not namespaces.' },
  {
    selector: 'ClassDeclaration[superClass=null]',
    message: 'Use functions and plain data; a class only to extend Error.',
  },
];

const to = (...types) => ({ to: { element: { types } } });
const layer = (from, ...allowed) => ({
  from: { element: { type: from } },
  allow: [to(...allowed), { dependency: { relationship: { to: 'internal' } } }],
});
const packages = (from, sources, why) => ({
  from: { element: { type: from } },
  allow: { to: { module: { origin: ['external', 'core'], source: sources } } },
  message: why,
});

const DEPENDENCIES = {
  default: 'disallow',
  checkAllOrigins: true, // packages and node built-ins obey the layers too
  checkUnknownLocals: true,
  message:
    '{{from.element.types.[0]}} may not import {{to.element.types.[0]}}{{#if to.module.source}} ({{to.module.source}}){{/if}}. See docs/architecture.md.',
  policies: [
    layer('domain', 'shared'),
    layer('application', 'domain', 'shared'),
    layer('infrastructure', 'domain', 'application', 'shared'),
    layer('ui', 'shared'),
    layer('feature', 'application', 'domain', 'ui', 'shared'),
    layer('app', 'feature', 'ui', 'application', 'infrastructure', 'domain', 'shared'),
    layer('shared'),
    layer('tools', 'infrastructure', 'application', 'domain', 'shared'),
    // a feature is one folder: others reach it through its index.ts, and features never reach into each other
    {
      from: { element: { type: 'app' } },
      disallow: { to: { element: { type: 'feature', fileInternalPath: '!index.ts' } } },
      message: 'Import a feature through its index.ts: @/features/{{to.element.captured.feature}}.',
    },
    // packages: each layer may use only what its job needs
    packages(
      'infrastructure',
      ['node:**', 'yaml', 'zod', 'ajv', 'ajv/**', 'ajv-formats', 'server-only'],
      'infrastructure uses node, yaml, zod, ajv and server-only.',
    ),
    packages(
      'tools',
      ['node:**', 'yaml', 'json-schema-to-typescript'],
      'tools use node, yaml and json-schema-to-typescript.',
    ),
    packages('ui', ['react', 'react-dom', 'next', 'next/*'], 'ui uses react and next only.'),
    packages(
      'feature',
      ['react', 'react-dom', 'next', 'next/*'],
      'features use react and next only.',
    ),
    packages('app', ['react', 'next', 'next/*'], 'routes use react and next only.'),
  ],
};

export default defineConfig([
  globalIgnores(['.next/**', 'out/**', 'coverage/**', 'next-env.d.ts']),

  js.configs.recommended,
  ...nextVitals,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  unicorn.configs.recommended,
  sonarjs.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: { reportUnusedDisableDirectives: 'error', reportUnusedInlineConfigs: 'error' },
  },

  /* ───────── TypeScript: say what you mean ───────── */
  {
    files: ['**/*.{ts,tsx,mts}'],
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true, requireDefaultForNonUnion: true },
      ],
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowString: false, allowNumber: false, allowNullableObject: true },
      ],
      '@typescript-eslint/prefer-readonly': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/require-array-sort-compare': 'error',
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'typeParameter', format: ['PascalCase'] },
        { selector: 'variable', modifiers: ['destructured'], format: null },
        { selector: 'variable', format: ['camelCase', 'UPPER_CASE', 'PascalCase'] },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': 'error',
      'no-param-reassign': ['error', { props: true }],
      'no-nested-ternary': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'no-restricted-syntax': ['error', ...PLAIN_TS],
      // folders stay flat to read: anything outside this folder is imported by its @/ path
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['../*'], message: 'Import from another folder by its @/ path, not ../.' },
            { regex: '^@/(app)(/|$)', message: 'Nothing imports a route.' },
            {
              regex: String.raw`(?<!\.module)\.css$`,
              message:
                'Styles are CSS modules (*.module.css); only app/layout.tsx imports globals.css.',
            },
          ],
        },
      ],
    },
  },

  /* ───────── modules: one shape everywhere ───────── */
  {
    rules: {
      'import/no-default-export': 'error',
      // cycles are checked by dpdm (npm run cycles): import/no-cycle walks the whole graph for every file
      'import/no-self-import': 'error',
      'import/no-duplicates': ['error', { 'prefer-inline': true }],
      'import/no-extraneous-dependencies': [
        'error',
        { devDependencies: [...TESTS, ...CONFIGS, 'tools/**'] },
      ],
      'import/no-mutable-exports': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'unicorn/filename-case': ['error', { case: 'kebabCase', ignore: [/^\[.+\]$/] }],
      'unicorn/prevent-abbreviations': 'off',
      'sonarjs/deprecation': 'off', // @typescript-eslint/no-deprecated checks the same, faster
      'unicorn/no-null': 'off', // the model says "none" with null: YAML and JSON speak it
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/prefer-top-level-await': 'off',
    },
  },
  { files: ['src/app/layout.tsx'], rules: { 'no-restricted-imports': 'off' } },
  // Next.js and tool configs export a default by contract
  {
    files: [
      'src/app/**/{page,layout,template,not-found,error,global-error,loading,default,sitemap,robots,manifest,icon,apple-icon,opengraph-image,twitter-image}.tsx',
      ...CONFIGS,
    ],
    rules: { 'import/no-default-export': 'off', 'import/no-anonymous-default-export': 'off' },
  },

  /* ───────── size: small files, small functions, shallow code ───────── */
  {
    files: [SRC, 'tools/**/*.ts'],
    ignores: [...TESTS, 'src/**/*.generated.ts'],
    rules: {
      'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 60, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      'max-params': ['error', 3],
      'max-depth': ['error', 3],
      'max-nested-callbacks': ['error', 3],
      'max-statements': ['error', 20],
      complexity: ['error', 12],
      'sonarjs/cognitive-complexity': ['error', 12],
    },
  },
  // a component's markup reads as one block; allow it more lines, not more branches
  {
    files: ['src/**/*.tsx'],
    ignores: TESTS,
    rules: {
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
    },
  },

  /* ───────── React and Next.js ───────── */
  {
    files: ['src/**/*.tsx'],
    rules: {
      ...jsxA11y.flatConfigs.strict.rules,
      'react/forbid-dom-props': [
        'error',
        {
          forbid: [
            { propName: 'style', message: 'Style with a CSS module class or a data attribute.' },
          ],
        },
      ],
      'react/forbid-component-props': ['error', { forbid: ['style'] }],
      'react/jsx-no-useless-fragment': 'error',
      'react/no-array-index-key': 'error',
      'react/jsx-boolean-value': 'error',
      'react/self-closing-comp': 'error',
      'react/function-component-definition': ['error', { namedComponents: 'function-declaration' }],
      'react/no-unstable-nested-components': 'error',
      'react/jsx-no-leaked-render': 'error',
      '@next/next/no-html-link-for-pages': 'off', // pages router only; internal links are checked below
      'no-restricted-syntax': [
        'error',
        ...PLAIN_TS,
        {
          selector: String.raw`JSXOpeningElement[name.name="a"] > JSXAttribute[name.name="href"] > Literal[value=/^\//]`,
          message: 'Link inside the site with next/link.',
        },
      ],
    },
  },
  {
    plugins: { groundwork },
    files: [SRC],
    rules: {
      'groundwork/client-file-naming': 'error',
      'groundwork/app-route-files-only': 'error',
      'groundwork/static-export-only': 'error',
    },
  },
  { files: ['src/**/*.tsx'], rules: { 'groundwork/css-modules': 'error' } },

  /* ───────── architecture ───────── */
  {
    files: ['src/**/*.{ts,tsx}', 'tools/**/*.ts'],
    plugins: { boundaries },
    settings: {
      'boundaries/elements': ELEMENTS,
      'boundaries/include': ['src/**/*', 'tools/**/*'],
      'boundaries/ignore': TESTS,
    },
    rules: {
      'boundaries/dependencies': ['error', DEPENDENCIES],
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown-dependencies': 'error',
    },
  },
  // tools talk to a terminal
  {
    files: ['tools/**/*.ts'],
    rules: {
      'no-console': 'off',
      'unicorn/no-process-exit': 'off',
      'sonarjs/no-os-command-from-path': 'off', // tools run git from the developer's own PATH
    },
  },

  /* ───────── tests: still typed, still tidy, allowed to be long ───────── */
  {
    files: TESTS,
    rules: {
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'allow' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  prettier,
]);
