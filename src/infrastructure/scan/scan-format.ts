import 'server-only';

import { readFile } from 'node:fs/promises';

import Ajv2020 from 'ajv/dist/2020.js';

import { validateScanDocument } from '@/domain/scan/check-scan';
import type { ScanDocument } from '@/domain/scan/scan.generated';

export async function scanValidator(): Promise<(input: unknown) => ScanDocument> {
  const schema: unknown = JSON.parse(await readFile('schema/scan.schema.json', 'utf8'));
  if (typeof schema !== 'object' || schema === null) throw new Error('Expected scan schema object');
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const check = ajv.compile<ScanDocument>(schema);
  return (input) => {
    if (!check(input)) {
      const detail = check.errors
        ?.slice(0, 20)
        .map((error) => `${error.instancePath}: ${error.message ?? error.keyword}`)
        .join('; ');
      throw new Error(`ScanDocument: ${detail ?? 'invalid structure'}`);
    }
    const errors = validateScanDocument(input);
    if (errors.length > 0) {
      throw new Error(
        `ScanDocument: ${errors.slice(0, 20).join('; ')} (${String(errors.length)} errors)`,
      );
    }
    return input;
  };
}
