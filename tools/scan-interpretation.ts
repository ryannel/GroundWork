import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { interpretationClaims } from '@/domain/scan/interpretation-query';
import type { ScanInterpretation } from '@/domain/scan/interpretation.generated';
import { interpretationValidator } from '@/infrastructure/scan/interpretation-format';
import { interpretationInputManifest } from '@/infrastructure/scan/interpretation-inputs';
import { loadVerifiedScanSnapshot } from '@/infrastructure/scan/verified-scan-snapshot';

export async function readInterpretation(
  file: string,
  manifest: string,
): Promise<ScanInterpretation> {
  const inputs = interpretationInputManifest(JSON.parse(await readFile(manifest, 'utf8')));
  const loaded = await Promise.all(
    inputs.inputs.map(async (input) => {
      const filename = path.resolve(path.dirname(manifest), input.path);
      if (input.kind === 'scan_snapshot') {
        const verifiedSnapshot = await loadVerifiedScanSnapshot(filename, {
          kind: input.scanKind ?? 'source',
        });
        return { ...input, bytes: verifiedSnapshot.bytes, verifiedSnapshot };
      }
      return { ...input, bytes: await readFile(filename, 'utf8') };
    }),
  );
  const validate = await interpretationValidator(loaded);
  return validate(JSON.parse(await readFile(file, 'utf8')));
}
async function main(args: readonly string[]): Promise<void> {
  const [file, manifest, query] = args;
  const usage = 'Usage: scan-interpretation.ts <sidecar.json> <inputs.json> [--query]';
  if (file === undefined || manifest === undefined) throw new Error(usage);
  if (args.length > 3 || (query !== undefined && query !== '--query')) throw new Error(usage);
  const document = await readInterpretation(file, manifest);
  const result =
    query === '--query'
      ? interpretationClaims(document)
      : {
          format: 'scan-interpretation-validation/v1',
          label: 'inferred',
          state: document.state,
          claims: document.claims.length,
          attempts: document.attempts.length,
          runs: document.runs,
          observedSourceProof: 'separate_unchanged',
        };
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] === import.meta.filename) await main(process.argv.slice(2));
