import { readFile } from 'node:fs/promises';

import { expect, it } from 'vitest';

import { generateScanTypes } from './generate-scan-types';

it('keeps scan types generated from the authoritative schema', async () => {
  await expect(readFile('src/domain/scan/scan.generated.ts', 'utf8')).resolves.toBe(
    await generateScanTypes(),
  );
});
