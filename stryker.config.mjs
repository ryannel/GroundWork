// Mutation testing: Stryker plants small bugs in the pure layers and checks a test fails for each one.
// Coverage says a line ran; this says a test would notice if the line were wrong.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.mutation.config.ts', related: true },
  mutate: [
    'src/domain/**/*.ts',
    'src/application/**/*.ts',
    'src/shared/**/*.ts',
    '!**/*.test.ts',
    '!**/*.generated.ts',
  ],
  // the sandbox holds only what the unit tests read
  ignorePatterns: [
    '/*',
    '!/src',
    '!/workspaces',
    '!/schema',
    '!/package.json',
    '!/tsconfig.json',
    '!/ts-reset.d.ts',
    '!/vitest.mutation.config.ts',
    '!/test',
    '/test/**/*.test.ts',
    // only the pure layers' own tests are asked to kill their mutants
    '/src/{app,features,infrastructure,ui}/**/*.test.{ts,tsx}',
  ],
  // run only the tests that cover each mutant, and reuse last run's results for code that has not changed
  coverageAnalysis: 'perTest',
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  ignoreStatic: true,
  concurrency: 8,
  timeoutMS: 10_000,
  thresholds: { high: 90, low: 80, break: 75 },
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation.html' },
  cleanTempDir: 'always',
};
