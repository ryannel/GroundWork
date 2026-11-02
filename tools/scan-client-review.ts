import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { ScanDocument } from '@/domain/scan/scan.generated';
import { scanValidator } from '@/infrastructure/scan/scan-format';
import { sourceDigest } from '@/infrastructure/scan/source-index';

import { bindingReviewMutations } from './scan-bindings-mutations';
import { bindingReviewDocument, bindingReviewPages } from './scan-bindings-pages';
import { bindingReviewProofs } from './scan-bindings-proofs';
import { bindingReviewSelection } from './scan-bindings-selection';
import { profileQuestionMutations } from './scan-profile-question-mutations';
import { profileQuestionProofs } from './scan-profile-review';
import { profileReviewMutations } from './scan-profile-review-mutations';
import { auditScanSources } from './scan-source-audit';

const LIMITS = { maxTotalRecords: 32_768, maxTotalBytes: 33_554_432 };
const PIN = {
  repo: 'volvo-cars/cds-ecom-customer-service',
  commit: '09623ab3a1f39845d8fc02abc3d591b53a3b5fea',
};

async function checkerInputs(): Promise<
  readonly { readonly path: string; readonly digest: string }[]
> {
  const entries = await readdir(new URL('.', import.meta.url));
  const files = entries
    .filter((file) =>
      /^scan-(?:client-review|profile-|bindings-|outbound-review|mongo-review|exception-review|spring-review|semantic-query|source-audit)/u.test(
        file,
      ),
    )
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .toSorted((left, right) => left.localeCompare(right));
  return Promise.all(
    files.map(async (file) => ({
      path: `tools/${file}`,
      digest: sourceDigest(await readFile(new URL(file, import.meta.url), 'utf8')),
    })),
  );
}

function clientEvidence(document: ScanDocument) {
  if (
    !document.sources.every((source) => source.repo === PIN.repo && source.commit === PIN.commit)
  ) {
    throw new Error('Evidence is outside the frozen repository revision.');
  }
  const ids = bindingReviewSelection(document);
  const pages = bindingReviewPages(document, ids, LIMITS);
  const bounded = bindingReviewDocument(document.id, pages);
  const returned = new Set(pages.flatMap((page) => page.records).map((record) => record.id));
  return {
    pages,
    bounded,
    selectedRecords: ids.length,
    returnedRecords: returned.size,
    complete: returned.size === ids.length && ids.every((id) => returned.has(id)),
  };
}

async function review(input: string, cloneRoot: string) {
  const parse = await scanValidator();
  const document = parse(JSON.parse(await readFile(input, 'utf8')));
  const evidence = clientEvidence(document);
  const existing = bindingReviewProofs(evidence.bounded);
  const questions = profileQuestionProofs(evidence.bounded);
  const mutations = {
    existing: bindingReviewMutations(evidence.bounded),
    clients: profileReviewMutations(evidence.bounded),
    questions: profileQuestionMutations(evidence.bounded),
  };
  const sourcePins = auditScanSources(evidence.bounded, cloneRoot);
  const accepted = [
    evidence.complete,
    sourcePins.supported,
    Object.values(existing).every((proof) => proof.supported),
    questions.q12.supported,
    questions.q13.supported,
    Object.values(mutations).every((attempts) => attempts.every((attempt) => attempt.rejected)),
  ].every(Boolean);
  return {
    pages: evidence.pages,
    sourcePins,
    receipt: {
      format: 'client-review/v1',
      input: path.resolve(input),
      ...PIN,
      snapshot: evidence.pages[0]?.snapshot,
      checkerInputs: await checkerInputs(),
      limits: LIMITS,
      complete: evidence.complete,
      selectedRecords: evidence.selectedRecords,
      returnedRecords: evidence.returnedRecords,
      pages: evidence.pages.length,
      bytes: Buffer.byteLength(JSON.stringify(evidence.pages)),
      existing,
      questions,
      mutations,
      accepted,
    },
  };
}

async function run(args: readonly string[]): Promise<void> {
  const [input, cloneRoot, output] = args;
  if (input === undefined || cloneRoot === undefined || output === undefined || args.length !== 3) {
    throw new Error('Usage: scan-client-review.ts <document.json> <clone-root> <NEW-output>');
  }
  const result = await review(input, cloneRoot);
  await mkdir(output);
  for (const [file, value] of [
    ['pages.json', result.pages],
    ['source-pins.json', result.sourcePins],
    ['receipt.json', result.receipt],
  ] as const) {
    await writeFile(path.join(output, file), `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  }
  console.log(JSON.stringify({ output, accepted: result.receipt.accepted }));
  if (!result.receipt.accepted) process.exitCode = 2;
}

if (process.argv[1] === import.meta.filename) await run(process.argv.slice(2));
