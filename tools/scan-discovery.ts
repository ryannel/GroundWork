import { readFile } from 'node:fs/promises';

import { assessDiscovery } from '@/domain/scan/discovery-check';
import { assessDiscoveryPublication } from '@/domain/scan/discovery-review';
import { discoveryValidator } from '@/infrastructure/scan/discovery-format';
import { parseDiscoveryReview } from '@/infrastructure/scan/discovery-review-format';
import { discoveryValidationVersion } from '@/infrastructure/scan/discovery-validation-version';

import { readDiscoveryInput } from './scan-discovery-io';
import {
  discoveryReviewIdentity,
  discoveryReviewOptions,
  discoveryValidationReceipt,
} from './scan-discovery-review';

export async function checkDiscovery(args: readonly string[]): Promise<boolean> {
  const [inventory, interpretation, inputs, discovery, ...options] = args;
  if (
    inventory === undefined ||
    interpretation === undefined ||
    inputs === undefined ||
    discovery === undefined
  ) {
    throw new Error(
      'Usage: scan-discovery.ts <inventory.json> <interpretation.json> <inputs.json> <discovery.json> [--review <receipt.json>] [--require-complete]',
    );
  }
  const flags = discoveryReviewOptions(options);
  const [interpretationBytes, discoveryBytes] = await Promise.all([
    readFile(interpretation, 'utf8'),
    readFile(discovery, 'utf8'),
  ]);
  const input = await readDiscoveryInput({ inventory, interpretation, inputs });
  if (JSON.stringify(input.interpretation) !== JSON.stringify(JSON.parse(interpretationBytes))) {
    throw new Error('Interpretation changed while validating discovery. Retry with frozen inputs.');
  }
  const parse = await discoveryValidator(input);
  const document = parse(JSON.parse(discoveryBytes));
  const investigationCoverage = assessDiscovery(document, input);
  const version = await discoveryValidationVersion();
  const reviewIdentity = discoveryReviewIdentity(input, document, {
    ...version,
    interpretation: interpretationBytes,
    discovery: discoveryBytes,
  });
  const review =
    flags.review === undefined
      ? undefined
      : parseDiscoveryReview(JSON.parse(await readFile(flags.review, 'utf8')));
  const assessment = assessDiscoveryPublication({
    investigationCoverage,
    expected: reviewIdentity,
    ...(review === undefined ? {} : { review }),
  });
  console.log(
    JSON.stringify(
      discoveryValidationReceipt(input, document, {
        investigationCoverage,
        assessment,
        reviewIdentity,
      }),
      null,
      2,
    ),
  );
  return !flags.requireComplete || assessment.status === 'complete';
}

if (process.argv[1] === import.meta.filename && !(await checkDiscovery(process.argv.slice(2)))) {
  process.exitCode = 1;
}
