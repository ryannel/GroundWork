import 'server-only';

import { readFile } from 'node:fs/promises';

import { discoveryDigest } from './discovery-inventory-source';

/** Rules and packaging changes invalidate discovery without invalidating source parser caches. */
export async function discoveryAnalysisVersion(): Promise<string> {
  const files = [
    'tools/scan-discovery-inventory.ts',
    'src/infrastructure/scan/discovery-inventory-source.ts',
    'src/infrastructure/scan/discovery-inventory-rules.ts',
    'src/infrastructure/scan/discovery-inventory-packets.ts',
    'src/infrastructure/scan/discovery-inventory-version.ts',
    'src/infrastructure/scan/discovery-inventory-verify.ts',
    'src/infrastructure/scan/discovery-format-inputs.ts',
    'src/domain/scan/discovery-types.ts',
    'schema/scan-discovery.schema.json',
  ];
  const digests = await Promise.all(
    files.map(async (filename) => ({
      filename,
      sha256: discoveryDigest(await readFile(filename)),
    })),
  );
  return discoveryDigest(JSON.stringify(digests));
}
