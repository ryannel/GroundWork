import { defineConfig } from '@playwright/test';

// Boot-tier smoke configuration. The suite launches this app's own Electron
// binary through Playwright's _electron driver — no browser downloads are
// needed (`playwright install` is not required). On Linux CI it runs under
// xvfb; tool/electron_exec.sh handles the display guard
// (docs/principles/stack/electron/security.md → testing references).
export default defineConfig({
  testDir: './tests/smoke',
  timeout: 60_000,
  // The smoke drives one app instance; keep the lane serial and thin.
  fullyParallel: false,
  workers: 1,
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
