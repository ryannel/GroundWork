import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { interpretationErrors } from '@/domain/scan/interpretation-check';
import type { InterpretationSnapshot } from '@/domain/scan/interpretation-context';
import type { ScanInterpretation } from '@/domain/scan/interpretation.generated';
import type { RepositoryReadinessInput } from '@/domain/scan/repository-readiness-types';
import { interpretationDigest } from '@/infrastructure/scan/interpretation-format';
import { interpretationInputManifest } from '@/infrastructure/scan/interpretation-inputs';
import { scanValidator } from '@/infrastructure/scan/scan-format';

import { readInterpretation } from './scan-interpretation';

async function readSnapshots(manifest: string): Promise<readonly InterpretationSnapshot[]> {
  const inputs = interpretationInputManifest(JSON.parse(await readFile(manifest, 'utf8')));
  const parse = await scanValidator();
  return Promise.all(
    inputs.inputs.map(async (input): Promise<InterpretationSnapshot> => {
      const bytes = await readFile(path.resolve(path.dirname(manifest), input.path), 'utf8');
      const shared = { id: input.id, sha256: interpretationDigest(bytes) };
      return input.kind === 'scan_snapshot'
        ? { ...shared, kind: input.kind, document: parse(JSON.parse(bytes)) }
        : { ...shared, kind: input.kind, uri: input.uri, revision: input.revision, text: bytes };
    }),
  );
}
function assertCurrentTarget(
  document: ScanInterpretation,
  target: { readonly sha256: string; readonly scanId: string },
): void {
  if (document.state !== 'complete') throw new Error('Readiness interpretation is not complete.');
  const ids = new Set(
    document.contexts
      .filter(
        (context) =>
          context.kind === 'scan_snapshot' &&
          context.role === 'target' &&
          context.sha256 === target.sha256 &&
          context.scan_id === target.scanId,
      )
      .map((context) => context.id),
  );
  const grounded = document.attempts.every((attempt) =>
    document.runs.some(
      (run) => run.id === attempt.run_id && run.input_context_ids.some((id) => ids.has(id)),
    ),
  );
  if (ids.size === 0 || !grounded) {
    throw new Error(
      'Readiness interpretation must use the exact current catalogue metadata snapshot in every completed area attempt; a historical repository/commit match is insufficient.',
    );
  }
}
/** Verify actual input bytes and bind readiness to this catalogue, not just its source revision. */
export async function readReadinessInterpretation(
  sidecar: string,
  manifest: string,
  currentMetadata: string,
): Promise<RepositoryReadinessInput['interpretation']> {
  const document = await readInterpretation(sidecar, manifest);
  const snapshots = await readSnapshots(manifest);
  const errors = interpretationErrors(document, snapshots);
  if (errors.length > 0) {
    throw new Error(`Readiness interpretation inputs changed: ${errors.join('; ')}`);
  }
  const bytes = await readFile(currentMetadata, 'utf8');
  const parse = await scanValidator();
  const metadata = parse(JSON.parse(bytes));
  assertCurrentTarget(document, { sha256: interpretationDigest(bytes), scanId: metadata.id });
  return { document, snapshots };
}
