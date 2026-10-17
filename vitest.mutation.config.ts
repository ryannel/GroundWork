import path from 'node:path';

import { defineConfig } from 'vitest/config';

// Stryker's vitest runner cannot pick a project, so mutation runs get their own flat config: the pure layers' tests.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: { include: ['src/{domain,application,shared}/**/*.test.ts'] },
});
