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
          include: ['src/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
          setupFiles: ['test/fail-on-console-error.ts'],
        },
      },
      // slow: lints fixtures in a copy of the repo. Runs in check, pre-push and CI. Forks, as it calls chdir.
      { extends: true, test: { name: 'architecture', include: ['test/**/*.test.ts'] } },
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
