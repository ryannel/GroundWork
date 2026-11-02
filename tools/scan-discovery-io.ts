import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { DiscoveryInput } from '@/domain/scan/discovery-types';
import type { InterpretationSnapshot } from '@/domain/scan/interpretation-context';
import { interpretationDigest } from '@/infrastructure/scan/interpretation-format';
import { interpretationInputManifest } from '@/infrastructure/scan/interpretation-inputs';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import {
  loadVerifiedScanSnapshot,
  verifiedSnapshotDocument,
} from '@/infrastructure/scan/verified-scan-snapshot';

import { readDiscoveryInventory } from './scan-discovery-inventory';
import { readInterpretation } from './scan-interpretation';

interface DiscoveryFiles {
  readonly inventory: string;
  readonly interpretation: string;
  readonly inputs: string;
}

async function suppliedSnapshots(filename: string): Promise<readonly InterpretationSnapshot[]> {
  const manifest = interpretationInputManifest(JSON.parse(await readFile(filename, 'utf8')));
  const parse = await scanValidator();
  const snapshots: InterpretationSnapshot[] = [];
  for (const input of manifest.inputs) {
    const file = path.resolve(path.dirname(filename), input.path);
    if (input.kind === 'scan_snapshot') {
      const snapshot = await loadVerifiedScanSnapshot(file, { kind: input.scanKind ?? 'source' });
      snapshots.push({
        kind: input.kind,
        id: input.id,
        sha256: interpretationDigest(snapshot.bytes),
        document: parse(verifiedSnapshotDocument(snapshot, snapshot.bytes)),
      });
    } else {
      const text = await readFile(file, 'utf8');
      snapshots.push({
        kind: input.kind,
        id: input.id,
        sha256: interpretationDigest(text),
        uri: input.uri,
        revision: input.revision,
        text,
      });
    }
  }
  return snapshots;
}

/** Load actual evidence bytes; a successful historical validation receipt is not an input. */
export async function readDiscoveryInput(files: DiscoveryFiles): Promise<DiscoveryInput> {
  if (path.basename(files.inventory) !== 'inventory.json') {
    throw new Error('Use the independently published discovery inventory.json.');
  }
  const inventory = await readDiscoveryInventory(path.dirname(files.inventory));
  const interpretation = await readInterpretation(files.interpretation, files.inputs);
  const snapshots = await suppliedSnapshots(files.inputs);
  return { inventory, interpretation, snapshots };
}
