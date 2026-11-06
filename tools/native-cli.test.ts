// Direct Node commands must keep working without the app loader, including from another folder.
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { expect, it } from 'vitest';

it.each(['permalink', 'sources', 'scan-status'])(
  'runs the standalone %s command outside the checkout',
  (name) => {
    const result = spawnSync(process.execPath, [path.join(import.meta.dirname, `${name}.ts`)], {
      cwd: tmpdir(),
      encoding: 'utf8',
    });
    expect(result.status, result.stderr).toBe(2);
    expect(result.stderr).toContain('usage:');
    expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
  },
);
