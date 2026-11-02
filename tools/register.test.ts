import { execFileSync } from 'node:child_process';

import { expect, it } from 'vitest';

it('resolves aliased JSON imports in an actual Node CLI', () => {
  const output = execFileSync(
    process.execPath,
    [
      '--import',
      './tools/register.ts',
      '--input-type=module',
      '--eval',
      'import value from "@/../test/fixtures/scan/benchmark-reference.json" with {type:"json"}; console.log(value.format);',
    ],
    { encoding: 'utf8', timeout: 10_000 },
  );
  expect(output.trim()).toBe('benchmark-reference/v1');
});
