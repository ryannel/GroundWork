// The lint rules are the architecture, written down where it is checked. docs/architecture.md explains each layer.
// Every rule is an error, nothing may be switched off in a comment, and test/architecture.test.ts proves each fires.
import js from '@eslint/js';
import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import vitest from '@vitest/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import noSecrets from 'eslint-plugin-no-secrets';
import noUnsanitized from 'eslint-plugin-no-unsanitized';
import regexp from 'eslint-plugin-regexp';
import security from 'eslint-plugin-security';
import sonarjs from 'eslint-plugin-sonarjs';
import testingLibrary from 'eslint-plugin-testing-library';
import unicorn from 'eslint-plugin-unicorn';
import tseslint from 'typescript-eslint';

import groundwork from './eslint/groundwork-plugin.mjs';

const SRC = 'src/**/*.{ts,tsx}';
const CODE = [SRC, 'tools/**/*.ts'];
const TESTS = ['**/*.test.{ts,tsx}', 'test/**/*.{ts,tsx}'];
const CONFIGS = ['*.config.{ts,mjs,js}', 'eslint/**/*.mjs'];
const GENERATED = 'src/**/*.generated.ts';
const PURE = ['src/domain/**/*.ts', 'src/application/**/*.ts', 'src/shared/**/*.ts'];
const error = (...names) => Object.fromEntries(names.map((name) => [name, 'error']));

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
  {
    selector: 'ExportAllDeclaration',
    message: 'Export by name, so the public face of a module is written down.',
  },
  { selector: 'ForInStatement', message: 'Use for…of over Object.entries/keys/values.' },
  {
    selector: 'Property[key.name="shell"][value.value=true]',
    message: 'Run a program with its arguments, never through a shell.',
  },
  {
    selector:
      'TSTypeReference[typeName.name=/^(FC|FunctionComponent|VFC)$/], TSQualifiedName[right.name=/^(FC|FunctionComponent|VFC)$/]',
    message: 'Type the props and let the function declaration say it is a component.',
  },
];

// domain, application and shared give the same answer for the same input: no clock, no chance, no world
const IMPURE = [
  {
    selector: 'NewExpression[callee.name="Date"][arguments.length=0]',
    message: 'A pure layer takes today as an argument; the caller reads the clock.',
  },
  {
    selector: 'CallExpression[callee.object.name="Date"][callee.property.name="now"]',
    message: 'A pure layer takes the time as an argument; the caller reads the clock.',
  },
  {
    selector: 'CallExpression[callee.object.name="Math"][callee.property.name="random"]',
    message: 'A pure layer is deterministic; pass the random value in.',
  },
];
const IMPURE_GLOBALS = [
  'window',
  'document',
  'navigator',
  'location',
  'history',
  'localStorage',
  'sessionStorage',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'performance',
  'crypto',
  'process',
  'globalThis',
].map((name) => ({
  name,
  message: `${name} reaches outside a pure layer; pass what you need in.`,
}));

// next/* that needs a server or belongs to the pages router has no place in a static app-router site
const NEXT_BANNED = [
  ['next/router', 'Use next/navigation: this is the app router.'],
  ['next/head', 'Export metadata or generateMetadata from the route.'],
  ['next/document', 'The root layout is the document.'],
  ['next/legacy/image', 'Use next/image.'],
  ['next/amp', 'AMP is not supported.'],
  ['next/headers', 'The site is a static export: there is no request.'],
  ['next/server', 'The site is a static export: there is no server.'],
  ['next/cache', 'The site is a static export: nothing is revalidated.'],
  ['next/after', 'The site is a static export: there is no request.'],
  ['react-dom/server', 'Next.js renders; do not render to strings yourself.'],
].map(([name, message]) => ({ name, message }));
const RESTRICTED_PATHS = [
  ...NEXT_BANNED,
  {
    name: 'node:child_process',
    importNames: ['exec', 'execSync'],
    message: 'exec runs a shell. Use execFile or spawn with an argument list.',
  },
  { name: 'child_process', message: 'Import node built-ins with the node: prefix.' },
];
const RESTRICTED_PATTERNS = [
  { group: ['../*'], message: 'Import from another folder by its @/ path, not ../.' },
  { regex: '^@/(app)(/|$)', message: 'Nothing imports a route.' },
  { group: ['next/dist/*'], message: 'Import next by its public entry points.' },
];
const CSS_PATTERN = {
  regex: String.raw`(?<!\.module)\.css$`,
  message: 'Styles are CSS modules (*.module.css); only app/layout.tsx imports globals.css.',
};

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
  globalIgnores([
    '.next/**',
    'out/**',
    'coverage/**',
    'reports/**',
    '.stryker-tmp/**',
    'next-env.d.ts',
  ]),

  js.configs.recommended,
  ...nextVitals,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  unicorn.configs.recommended,
  sonarjs.configs.recommended,
  regexp.configs['flat/recommended'],
  comments.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    linterOptions: {
      // no rule is switched off in a comment: change the config, on purpose, where it is reviewed
      noInlineConfig: true,
      reportUnusedDisableDirectives: 'error',
      reportUnusedInlineConfigs: 'error',
    },
  },

  /* ───────── no escape hatches ───────── */
  {
    rules: {
      '@eslint-community/eslint-comments/no-use': ['error', { allow: [] }],
      'no-warning-comments': [
        'error',
        { terms: ['todo', 'fixme', 'xxx', 'hack'], location: 'start' },
      ],
    },
  },

  /* ───────── TypeScript: say what you mean ───────── */
  {
    files: ['**/*.{ts,tsx,mts}'],
    rules: {
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': true, 'ts-ignore': true, 'ts-nocheck': true, 'ts-check': true },
      ],
      '@typescript-eslint/method-signature-style': ['error', 'property'],
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
      '@typescript-eslint/strict-void-return': 'error',
      '@typescript-eslint/default-param-last': 'error',
      '@typescript-eslint/no-use-before-define': [
        'error',
        { functions: false, typedefs: false, ignoreTypeReferences: true },
      ],
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
        { paths: RESTRICTED_PATHS, patterns: [...RESTRICTED_PATTERNS, CSS_PATTERN] },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message:
            'Read the environment in one place (src/infrastructure/workspace-folders.ts, a tool or a config) and pass values in.',
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
        { devDependencies: [...TESTS, ...CONFIGS, 'tools/**', 'ts-reset.d.ts'] },
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
      'import/no-unassigned-import': [
        'error',
        { allow: ['server-only', '**/*.css', '@total-typescript/ts-reset/*'] },
      ],
      ...error(
        'import/no-useless-path-segments',
        'import/no-relative-packages',
        'import/no-empty-named-blocks',
        'import/no-named-as-default',
        'import/no-named-as-default-member',
        'import/no-named-default',
        'import/no-absolute-path',
        'import/no-webpack-loader-syntax',
        'import/no-dynamic-require',
        'import/no-commonjs',
        'import/no-amd',
        'import/no-import-module-exports',
        'import/no-namespace',
      ),
      'unicorn/filename-case': ['error', { case: 'kebabCase', ignore: [/^\[.+\]$/u] }],
      'unicorn/prevent-abbreviations': 'off', // too many false alarms on the model's own words; id-denylist names the bad ones
      'sonarjs/deprecation': 'off', // @typescript-eslint/no-deprecated checks the same, faster
      // Each rule below either repeats a faster rule or cannot fire here; together they were a third of lint time.
      'sonarjs/assertions-in-tests': 'off', // vitest/expect-expect checks the same
      'sonarjs/no-dead-store': 'off', // no-useless-assignment checks the same
      'sonarjs/no-redundant-assignments': 'off', // no-useless-assignment checks the same
      '@typescript-eslint/no-unsafe-enum-assignment': 'off', // enums are banned outright (erasableSyntaxOnly)
      ...Object.fromEntries(
        Object.keys(sonarjs.rules)
          .filter((rule) => rule.startsWith('aws-'))
          .map((rule) => [`sonarjs/${rule}`, 'off']), // AWS CDK checks: there is no CDK code
      ),
      'unicorn/no-null': 'off', // the model says "none" with null: YAML and JSON speak it
      'unicorn/no-array-reduce': 'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/prefer-top-level-await': 'off',
    },
  },
  // the root layout is the one file that imports globals.css
  {
    files: ['src/app/layout.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: RESTRICTED_PATHS, patterns: RESTRICTED_PATTERNS },
      ],
    },
  },
  // Next.js and tool configs export a default by contract
  {
    files: [
      'src/app/**/{page,layout,template,not-found,error,global-error,loading,default,sitemap,robots,manifest,icon,apple-icon,opengraph-image,twitter-image}.tsx',
      ...CONFIGS,
    ],
    rules: { 'import/no-default-export': 'off', 'import/no-anonymous-default-export': 'off' },
  },

  /* ───────── types: every shape written down, every value read-only ───────── */
  {
    files: CODE,
    ignores: [...TESTS, GENERATED],
    plugins: { groundwork },
    rules: {
      'groundwork/readonly-types': 'error',
      'react/prefer-read-only-props': 'error',
    },
  },
  // a module's exports are its contract: their types are written, not inferred (components return JSX)
  {
    files: ['src/**/*.ts', 'tools/**/*.ts'],
    ignores: [...TESTS, GENERATED],
    rules: { '@typescript-eslint/explicit-module-boundary-types': 'error' },
  },

  /* ───────── security: nothing a scanner would flag ───────── */
  {
    plugins: { 'no-unsanitized': noUnsanitized, security, 'no-secrets': noSecrets },
    rules: {
      ...error(
        'no-eval',
        'no-new-func',
        'no-script-url',
        'no-proto',
        'no-caller',
        'no-extend-native',
        'no-iterator',
        'no-alert',
        'no-unsanitized/method',
        'no-unsanitized/property',
        'security/detect-bidi-characters',
        'security/detect-buffer-noassert',
        'security/detect-child-process',
        'security/detect-disable-mustache-escape',
        'security/detect-eval-with-expression',
        'security/detect-new-buffer',
        'security/detect-no-csrf-before-method-override',
        'security/detect-non-literal-regexp',
        'security/detect-non-literal-require',
        'security/detect-possible-timing-attacks',
        'security/detect-pseudoRandomBytes',
        'sonarjs/os-command',
        'sonarjs/confidential-information-logging',
        'unicorn/require-post-message-target-origin',
        // a regex that backtracks or crawls on crafted input is a denial of service (CodeQL js/redos, js/polynomial-redos)
        'regexp/no-super-linear-move',
      ),
      'regexp/require-unicode-regexp': 'error',
      'no-secrets/no-secrets': ['error', { tolerance: 4.5 }],
    },
  },
  {
    files: ['src/**/*.tsx'],
    rules: {
      'react/no-danger': 'error',
      'react/jsx-no-script-url': 'error',
      'react/jsx-no-target-blank': [
        'error',
        { allowReferrer: false, enforceDynamicLinks: 'always', links: true, forms: true },
      ],
      'react/iframe-missing-sandbox': 'error',
      'react/no-invalid-html-attribute': 'error',
    },
  },
  // the theme script must run before paint, so the root layout inlines one constant string
  { files: ['src/app/layout.tsx'], rules: { 'react/no-danger': 'off' } },

  /* ───────── clean code: plain, direct, one way to say each thing ───────── */
  {
    files: CODE,
    ignores: [GENERATED],
    rules: {
      ...error(
        'no-lonely-if',
        'no-unneeded-ternary',
        'no-implicit-coercion',
        'prefer-object-has-own',
        'array-callback-return',
        'no-promise-executor-return',
        'no-constructor-return',
        'no-self-compare',
        'no-template-curly-in-string',
        'no-unmodified-loop-condition',
        'no-unreachable-loop',
        'require-atomic-updates',
        'no-useless-assignment',
        'no-return-assign',
        'no-sequences',
        'no-multi-assign',
        'no-labels',
        'no-new',
        'radix',
        'symbol-description',
        'logical-assignment-operators',
        'operator-assignment',
        'prefer-exponentiation-operator',
        'prefer-regex-literals',
        'no-useless-concat',
        'no-useless-call',
        'no-useless-rename',
        'no-useless-return',
        'no-useless-computed-key',
        'no-lone-blocks',
        'no-undef-init',
        'no-object-constructor',
        'default-case-last',
        'no-inner-declarations',
        'prefer-arrow-callback',
        'unicorn/no-unused-properties',
        'unicorn/custom-error-definition',
        'sonarjs/no-collapsible-if',
        'sonarjs/prefer-immediate-return',
        'sonarjs/no-inconsistent-returns',
        'sonarjs/no-nested-switch',
        'sonarjs/nested-control-flow',
        'sonarjs/no-function-declaration-in-block',
        'sonarjs/no-commented-code',
        'sonarjs/no-unused-function-argument',
        'sonarjs/no-for-in-iterable',
        'sonarjs/strings-comparison',
        'sonarjs/no-incorrect-string-concat',
        'sonarjs/operation-returning-nan',
        'sonarjs/values-not-convertible-to-numbers',
        'sonarjs/non-number-in-arithmetic-expression',
        'sonarjs/arguments-usage',
        'sonarjs/no-built-in-override',
        'sonarjs/no-wildcard-import',
        'sonarjs/too-many-break-or-continue-in-loop',
        'sonarjs/no-undefined-assignment',
      ),
      'no-else-return': ['error', { allowElseIf: false }],
      'no-void': ['error', { allowAsStatement: true }],
      'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
      'arrow-body-style': ['error', 'as-needed'],
      'func-style': ['error', 'declaration', { allowArrowFunctions: true }],
      'max-classes-per-file': ['error', 1],
      // names that say nothing: name a value for what it is
      'id-denylist': [
        'error',
        'tmp',
        'temp',
        'foo',
        'baz',
        'obj',
        'arr',
        'str',
        'num',
        'ret',
        'retval',
        'stuff',
        'misc',
        'helper',
        'helpers',
        'util',
        'utils',
        'manager',
        'val',
        'res',
        'cb',
        'err',
      ],
      'sonarjs/expression-complexity': ['error', { max: 3 }],
      'sonarjs/max-union-size': ['error', { threshold: 8 }],
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],
      'import/max-dependencies': ['error', { max: 15, ignoreTypeImports: true }],
    },
  },
  // the app reads files one after another on purpose only in tools, where order is the output
  {
    files: [SRC],
    ignores: TESTS,
    rules: { 'no-await-in-loop': 'error' },
  },

  /* ───────── size: small files, small functions, shallow code ───────── */
  {
    files: CODE,
    ignores: [...TESTS, GENERATED],
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
      // a spread before key makes JSX fall back to createElement, and React then reports the children as unkeyed
      'react/jsx-key': [
        'error',
        { checkFragmentShorthand: true, checkKeyMustBeforeSpread: true, warnOnDuplicates: true },
      ],
      'react/jsx-boolean-value': 'error',
      'react/self-closing-comp': 'error',
      'react/function-component-definition': ['error', { namedComponents: 'function-declaration' }],
      'react/no-unstable-nested-components': 'error',
      'react/jsx-no-leaked-render': 'error',
      ...error(
        'react/button-has-type',
        'react/void-dom-elements-no-children',
        'react/jsx-no-constructed-context-values',
        'react/no-object-type-as-default-prop',
        'react/hook-use-state',
        'react/jsx-pascal-case',
        'react/no-this-in-sfc',
        'react/no-typos',
        'react/no-namespace',
        'react/jsx-handler-names',
        'react/checked-requires-onchange-or-readonly',
      ),
      'react/jsx-curly-brace-presence': [
        'error',
        { props: 'never', children: 'never', propElementValues: 'always' },
      ],
      'react/jsx-fragments': ['error', 'syntax'],
      'react/jsx-max-depth': ['error', { max: 6 }],
      'react/destructuring-assignment': ['error', 'always', { destructureInSignature: 'always' }],
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
      'groundwork/route-exports': 'error',
    },
  },
  { files: ['src/**/*.tsx'], rules: { 'groundwork/css-modules': 'error' } },
  // speed: a page draws what the reader asked for, and prefetches only what they reach for
  {
    files: ['src/**/*.tsx'],
    ignores: TESTS,
    rules: { 'groundwork/one-per-choice': 'error', 'groundwork/link-prefetch': 'error' },
  },
  // Known debt, not exemptions: each still draws every choice on the server. Take a file off when it is fixed.
  {
    files: [
      'src/features/plan/chapters/part/part-screen.tsx',
      'src/features/plan/today/journey-walk.tsx',
    ],
    rules: { 'groundwork/one-per-choice': 'off' },
  },
  { files: ['src/ui/intent-link.client.tsx'], rules: { 'groundwork/link-prefetch': 'off' } },

  /* ───────── architecture ───────── */
  {
    files: CODE,
    plugins: { boundaries, groundwork },
    settings: {
      'boundaries/elements': ELEMENTS,
      'boundaries/include': ['src/**/*', 'tools/**/*'],
      'boundaries/ignore': TESTS,
    },
    rules: {
      'boundaries/dependencies': ['error', DEPENDENCIES],
      'boundaries/no-unknown-files': 'error',
      'boundaries/no-unknown-dependencies': 'error',
      'groundwork/server-only': 'error',
      'groundwork/barrel-exports-only': 'error',
      'groundwork/no-junk-drawer-names': 'error',
    },
  },
  // domain, application and shared are pure: the same input gives the same answer, anywhere
  {
    files: PURE,
    ignores: TESTS,
    rules: {
      'no-restricted-globals': ['error', ...IMPURE_GLOBALS],
      'no-restricted-syntax': ['error', ...PLAIN_TS, ...IMPURE],
    },
  },
  // the environment is read in one place, and tools and configs are run by people
  {
    files: ['src/infrastructure/workspace-folders.ts', 'tools/**/*.ts', ...CONFIGS],
    rules: { 'no-restricted-properties': 'off' },
  },
  // tools talk to a terminal
  {
    files: ['tools/**/*.ts'],
    rules: {
      'no-console': 'off',
      'unicorn/no-process-exit': 'off',
      'sonarjs/no-os-command-from-path': 'off', // tools run git from the developer's own PATH
      'security/detect-child-process': 'off', // tools run git; exec and shell: true stay banned above
    },
  },

  /* ───────── tests: still typed, still tidy, allowed to be long ───────── */
  {
    files: TESTS,
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      ...error(
        'vitest/no-focused-tests',
        'vitest/no-disabled-tests',
        'vitest/no-conditional-expect',
        'vitest/no-standalone-expect',
        'vitest/no-test-return-statement',
        'vitest/no-duplicate-hooks',
        'vitest/no-test-prefixes',
        'vitest/no-alias-methods',
        'vitest/prefer-hooks-on-top',
        'vitest/prefer-hooks-in-order',
        'vitest/prefer-to-be',
        'vitest/prefer-to-have-length',
        'vitest/prefer-to-contain',
        'vitest/prefer-expect-resolves',
        'vitest/prefer-mock-promise-shorthand',
        'vitest/prefer-import-in-mock',
        'vitest/require-mock-type-parameters',
        'vitest/require-to-throw-message',
      ),
      'vitest/consistent-test-it': ['error', { fn: 'it', withinDescribe: 'it' }],
      'vitest/valid-expect': ['error', { maxArgs: 2 }],
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expect*', 'assert*'] }],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'as', objectLiteralTypeAssertions: 'allow' },
      ],
      '@typescript-eslint/no-unsafe-type-assertion': 'off', // a fixture may say what it stands for
      '@typescript-eslint/no-non-null-assertion': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },
  {
    files: ['src/**/*.test.tsx'],
    ...testingLibrary.configs['flat/react'],
  },
  {
    files: ['src/**/*.test.tsx'],
    rules: {
      // the design system styles state with data attributes, so tests read them off the nodes
      'testing-library/no-node-access': 'off',
      'testing-library/no-container': 'off',
      'testing-library/no-manual-cleanup': 'off', // vitest runs without globals, so tests clean up
      'testing-library/render-result-naming-convention': 'off',
      // with Suspense and use(), React draws the waiting tree only inside an awaited act around render
      'testing-library/no-unnecessary-act': 'off',
    },
  },
  {
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { 'import/no-named-as-default-member': 'off' }, // plugins publish their configs on the default export
  },

  prettier,
  // prettier switches curly off; multi-line keeps one-line guards and braces everything else
  { rules: { curly: ['error', 'multi-line'] } },
]);
