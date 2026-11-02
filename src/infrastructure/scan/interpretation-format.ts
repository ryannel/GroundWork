import 'server-only';

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import { interpretationErrors } from '@/domain/scan/interpretation-check';
import type { InterpretationSnapshot } from '@/domain/scan/interpretation-context';
import type { ScanInterpretation } from '@/domain/scan/interpretation.generated';

import { scanValidator } from './scan-format';
import { verifiedSnapshotDocument, type VerifiedScanSnapshot } from './verified-scan-snapshot';

export type InterpretationInput =
  | {
      readonly kind: 'scan_snapshot';
      readonly id: string;
      readonly bytes: string;
      readonly verifiedSnapshot?: VerifiedScanSnapshot;
    }
  | {
      readonly kind: 'context_snapshot';
      readonly id: string;
      readonly bytes: string;
      readonly uri: string;
      readonly revision: string;
    };

export function interpretationDigest(bytes: string): string {
  return createHash('sha256').update(bytes).digest('hex');
}
async function resolveInputs(
  inputs: readonly InterpretationInput[],
): Promise<readonly InterpretationSnapshot[]> {
  const parse = await scanValidator();
  return inputs.map((input) =>
    input.kind === 'scan_snapshot'
      ? {
          kind: input.kind,
          id: input.id,
          sha256: interpretationDigest(input.bytes),
          document: parse(
            input.verifiedSnapshot === undefined
              ? JSON.parse(input.bytes)
              : verifiedSnapshotDocument(input.verifiedSnapshot, input.bytes),
          ),
        }
      : {
          kind: input.kind,
          id: input.id,
          sha256: interpretationDigest(input.bytes),
          text: input.bytes,
          uri: input.uri,
          revision: input.revision,
        },
  );
}
/** Interpretations have a separate closed contract; observed source answers are never rewritten. */
export async function interpretationValidator(
  inputs: readonly InterpretationInput[],
): Promise<(input: unknown) => ScanInterpretation> {
  const schema: unknown = JSON.parse(
    await readFile('schema/scan-interpretation.schema.json', 'utf8'),
  );
  if (typeof schema !== 'object' || schema === null) {
    throw new Error('Expected interpretation schema');
  }
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const check = ajv.compile<ScanInterpretation>(schema);
  const snapshots = await resolveInputs(inputs);
  return (input) => {
    if (!check(input)) throw new Error(`ScanInterpretation: ${ajv.errorsText(check.errors)}`);
    const errors = interpretationErrors(input, snapshots);
    for (const claim of input.claims) {
      if (Buffer.byteLength(JSON.stringify(claim)) > 65_536) {
        errors.push(`${claim.id}: interpretation claim exceeds 64 KiB`);
      }
    }
    if (errors.length > 0) throw new Error(`ScanInterpretation: ${errors.slice(0, 20).join('; ')}`);
    return input;
  };
}
