import { format } from 'node:util';

import { captureOwnerStack } from 'react';
import { afterEach, beforeEach } from 'vitest';

// React reports duplicate keys, bad nesting and act() misuse through console.error and carries on rendering.
// Collect them and fail the test after it runs, so a throw cannot be swallowed by an error boundary.
// A test that expects an error silences it with its own vi.spyOn(console, 'error').

const { console: out } = globalThis;
const original = out.error;
const logged: string[] = [];

beforeEach(() => {
  logged.length = 0;
  out.error = (...args: unknown[]) => {
    logged.push(format(...args) + (captureOwnerStack() ?? ''));
  };
});

afterEach(() => {
  out.error = original;
  if (logged.length > 0) {
    throw new Error(`console.error was called:\n\n${logged.join('\n\n')}`);
  }
});
