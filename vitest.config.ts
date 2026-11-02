import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: {
    projects: [
      {
        extends: true,
        // threads start faster than the default forks; every file still gets a fresh module graph
        test: {
          name: 'unit',
          pool: 'threads',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/infrastructure/**/*.test.ts'],
          maxWorkers: 4,
          sequence: { groupOrder: 0 },
          setupFiles: ['test/fail-on-console-error.ts'],
        },
      },
      {
        extends: true,
        // Native compilers and disk/git fixtures need bounded concurrency and time to start.
        test: {
          name: 'integration',
          pool: 'threads',
          include: ['src/infrastructure/**/*.test.ts'],
          exclude: ['src/infrastructure/{scan,scan-explorer}/**/*.test.ts'],
          maxWorkers: 2,
          testTimeout: 30_000,
          hookTimeout: 60_000,
          sequence: { groupOrder: 1 },
          setupFiles: ['test/fail-on-console-error.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'scanner',
          pool: 'threads',
          include: ['src/infrastructure/{scan,scan-explorer}/**/*.test.ts', 'tools/**/*.test.ts'],
          maxWorkers: 2,
          testTimeout: 30_000,
          hookTimeout: 60_000,
          sequence: { groupOrder: 2 },
          setupFiles: ['test/fail-on-console-error.ts'],
        },
      },
      // slow: lints fixtures in a copy of the repo. Runs in check, pre-push and CI. Forks, as it calls chdir.
      {
        extends: true,
        test: {
          name: 'architecture',
          include: ['test/**/*.test.ts'],
          maxWorkers: 1,
          sequence: { groupOrder: 3 },
        },
      },
    ],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    coverage: {
      provider: 'v8',
      include: ['src/domain/**', 'src/application/**', 'src/shared/**'],
      exclude: ['**/*.test.*'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
