import path from 'node:path';

import { createScanRecordReader } from '@/infrastructure/scan/record-pages';
import { repositoryPassJson } from '@/infrastructure/scan/repository-pass-files';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import { sourceDigest } from '@/infrastructure/scan/source-index';

import { verifyReadinessNative } from './scan-readiness-native';
import {
  verifyRegressionCheckers,
  verifyRegressionMutations,
  verifyRegressionProofs,
} from './scan-readiness-regression-guards';
import { readinessObject, readinessString } from './scan-readiness-value';

/** Preserve the frozen regression oracle independently of the automatic production selector. */
export async function verifyReadinessRegression(input: {
  readonly regression: string;
  readonly native: string;
  readonly source: string;
}): Promise<void> {
  const receipt = readinessObject(await repositoryPassJson(input.regression));
  const native = readinessObject(await repositoryPassJson(input.native));
  const parse = await scanValidator();
  const file = readinessString(receipt.input);
  const document = parse(await repositoryPassJson(file));
  const extraction = readinessObject(
    await repositoryPassJson(path.join(path.dirname(file), 'receipt.json')),
  );
  const snapshot = createScanRecordReader(document).page({
    ids: [],
    maxRecords: 4,
    maxBytes: 65_536,
  }).snapshot;
  if (
    ![
      receipt.accepted === true,
      receipt.complete === true,
      receipt.snapshot === snapshot,
      extraction.checksum === sourceDigest(JSON.stringify(document)),
      path.resolve(readinessString(extraction.capture)) ===
        path.dirname(path.resolve(input.source)),
    ].every(Boolean)
  ) {
    throw new Error('Regression does not match current source extraction and bounded snapshot.');
  }
  const source = readinessObject(await repositoryPassJson(input.source));
  if (
    receipt.repo !== source.repo ||
    receipt.commit !== source.commit ||
    document.sources.length === 0 ||
    document.sources.some(
      (anchor) => anchor.repo !== source.repo || anchor.commit !== source.commit,
    )
  ) {
    throw new Error('Regression source pin does not match the current repository pass.');
  }
  await verifyRegressionCheckers(receipt.checkerInputs);
  verifyRegressionMutations(receipt.mutations);
  verifyRegressionProofs(receipt);
  await verifyReadinessNative(native, input.native, input.source);
}
