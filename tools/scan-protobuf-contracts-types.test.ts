import { readFile } from 'node:fs/promises';

import { expect, it } from 'vitest';

import { generateProtobufContractsTypes } from './scan-protobuf-contracts-types';

it('keeps the canonical protobuf contract types aligned with its closed schema', async () => {
  await expect(readFile('src/domain/scan/protobuf-contracts.generated.ts', 'utf8')).resolves.toBe(
    await generateProtobufContractsTypes(),
  );
});
