import 'server-only';

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { z } from 'zod';

import type { ScanDocument } from '@/domain/scan/scan.generated';
import type { ExplorerService } from '@/domain/service-explorer';
import {
  interpretationDigest,
  interpretationValidator,
  type InterpretationInput,
} from '@/infrastructure/scan/interpretation-format';

const inputsSchema = z.object({
  inputs: z.array(
    z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('scan_snapshot'), id: z.string(), path: z.string() }),
      z.object({
        kind: z.literal('context_snapshot'),
        id: z.string(),
        path: z.string(),
        uri: z.string(),
        revision: z.string(),
      }),
    ]),
  ),
});

export async function visualPurpose(input: {
  readonly interpretation: string;
  readonly inputs: string;
  readonly target: ScanDocument;
  readonly targetBytes: string;
}): Promise<ExplorerService['purpose']> {
  const manifest = inputsSchema.parse(JSON.parse(await readFile(input.inputs, 'utf8')));
  const inputs: readonly InterpretationInput[] = await Promise.all(
    manifest.inputs.map(async (item) => {
      const bytes = await readFile(path.resolve(path.dirname(input.inputs), item.path), 'utf8');
      return item.kind === 'scan_snapshot'
        ? { kind: item.kind, id: item.id, bytes }
        : { kind: item.kind, id: item.id, bytes, uri: item.uri, revision: item.revision };
    }),
  );
  const parse = await interpretationValidator(inputs);
  const interpreted = parse(JSON.parse(await readFile(input.interpretation, 'utf8')));
  const target = interpreted.contexts.find(
    (context) =>
      context.kind === 'scan_snapshot' &&
      context.role === 'target' &&
      context.scan_id === input.target.id &&
      context.sha256 === interpretationDigest(input.targetBytes),
  );
  if (target === undefined) {
    throw new Error('Interpretation does not target the selected exact metadata snapshot');
  }
  const claim = interpreted.claims.find(
    (item) =>
      item.kind === 'purpose' &&
      item.subject.kind === 'observed_record' &&
      item.subject.context_id === target.id,
  );
  if (claim?.kind !== 'purpose') throw new Error('Validated target purpose claim missing');
  return {
    label: 'Inferred',
    statement: claim.statement,
    confidence: claim.confidence,
    claim: claim.id,
  };
}
