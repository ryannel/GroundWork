import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Two unit-test projects, one per process context: main/shared code runs in
// plain Node (the security policy tests live there), renderer components run
// in jsdom with the bridge faked at the window seam. The boot smoke is NOT
// vitest — it is Playwright _electron (tests/smoke/), launched via the smoke
// target (docs/principles/stack/electron/process-model.md).
export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'main',
          environment: 'node',
          include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
});
