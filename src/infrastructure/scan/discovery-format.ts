import 'server-only';

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import Ajv2020 from 'ajv/dist/2020.js';

import { discoveryErrors } from '@/domain/scan/discovery-check';
import type { DiscoveryInput, DiscoveryInventory } from '@/domain/scan/discovery-types';
import type { ScanDiscovery } from '@/domain/scan/discovery.generated';

export { parseDiscoveryInventory } from './discovery-format-inputs';

/** Hash the ordered frozen inventory, excluding its self-referential digest. */
export function discoveryInventoryDigest(inventory: Omit<DiscoveryInventory, 'sha256'>): string {
  const { repo, commit, analysis_version, snapshot_sha256, candidates } = inventory;
  return createHash('sha256')
    .update(JSON.stringify({ repo, commit, analysis_version, snapshot_sha256, candidates }))
    .digest('hex');
}
function assertCanonicalBytes(input: DiscoveryInput): void {
  for (const snapshot of input.snapshots) {
    if (
      snapshot.kind === 'context_snapshot' &&
      createHash('sha256').update(snapshot.text).digest('hex') !== snapshot.sha256
    ) {
      throw new Error(
        `ScanDiscovery: canonical context ${snapshot.id} digest does not match its bytes.`,
      );
    }
  }
}
export async function discoveryValidator(
  input: DiscoveryInput,
): Promise<(value: unknown) => ScanDiscovery> {
  assertCanonicalBytes(input);
  if (discoveryInventoryDigest(input.inventory) !== input.inventory.sha256) {
    throw new Error('ScanDiscovery: frozen inventory digest does not match its contents.');
  }
  const schema: unknown = JSON.parse(await readFile('schema/scan-discovery.schema.json', 'utf8'));
  if (typeof schema !== 'object' || schema === null) throw new Error('Expected discovery schema');
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  const check = ajv.compile<ScanDiscovery>(schema);
  return (value) => {
    if (!check(value)) throw new Error(`ScanDiscovery: ${ajv.errorsText(check.errors)}`);
    const errors = discoveryErrors(value, input);
    if (errors.length > 0) throw new Error(`ScanDiscovery: ${errors.slice(0, 20).join('; ')}`);
    return value;
  };
}
