import { readFile, readdir } from 'node:fs/promises';

import { sourceDigest } from '@/infrastructure/scan/source-index';

import { readinessArray, readinessObject, readinessString } from './scan-readiness-value';

const MUTATIONS: Readonly<Record<string, number>> = {
  existing: 56,
  clients: 34,
  questions: 40,
  events: 22,
  messages: 30,
  orders: 21,
  archival: 22,
};
const CHECKER =
  /^scan-(?:archive-review|archival-review|order-review|native-answerability-replay|native-replay-|client-review|messages-review|message-review|events-review|event-review|profile-|bindings-|outbound-review|mongo-review|exception-review|spring-review|semantic-query|source-audit)/u;
export async function verifyRegressionCheckers(value: unknown): Promise<void> {
  const files = readinessArray(value).map(readinessObject);
  const entries = await readdir(new URL('.', import.meta.url));
  const expected = entries
    .filter((file) => CHECKER.test(file) && file.endsWith('.ts') && !file.endsWith('.test.ts'))
    .map((file) => `tools/${file}`);
  const names = files.map((file) => readinessString(file.path));
  if (
    files.length !== expected.length ||
    new Set(names).size !== names.length ||
    expected.some((name) => !names.includes(name))
  ) {
    throw new Error('Regression checker fingerprint roster is incomplete or duplicated.');
  }
  await Promise.all(
    files.map(async (file) => {
      const name = readinessString(file.path);
      if (sourceDigest(await readFile(name, 'utf8')) !== file.digest) {
        throw new Error('Regression checker changed after acceptance.');
      }
    }),
  );
}
export function verifyRegressionMutations(value: unknown): void {
  const groups = readinessObject(value);
  if (Object.keys(groups).length !== Object.keys(MUTATIONS).length) {
    throw new Error('Mutation group roster changed.');
  }
  const roster: Record<string, readonly string[]> = {};
  for (const [name, count] of Object.entries(MUTATIONS)) {
    const rows = readinessArray(groups[name]).map(readinessObject);
    const identities = rows.map(
      (row) =>
        `${readinessString(row.name)}:${typeof row.question === 'string' ? row.question : ''}`,
    );
    roster[name] = identities.toSorted((left, right) => left.localeCompare(right));
    const invalid = rows.some((row) => {
      const baseline = row.baselinePassed ?? row.baselineSupported;
      const applied =
        name === 'existing' || name === 'clients' || (row.applied ?? row.mutationApplied) === true;
      return row.rejected !== true || baseline !== true || !applied;
    });
    if (rows.length !== count || new Set(identities).size !== rows.length || invalid) {
      throw new Error(
        'A frozen regression mutation is missing, unapplied or lacks a passing baseline.',
      );
    }
  }
  const canonical = Object.fromEntries(
    Object.entries(roster).toSorted(([left], [right]) => left.localeCompare(right)),
  );
  if (
    sourceDigest(JSON.stringify(canonical)) !==
    '6988557adadb9cc5720c35660db6108b31da68fa39fcc26471a38862419f7970'
  ) {
    throw new Error('Frozen regression mutation identities changed.');
  }
}
export function verifyRegressionProofs(receipt: Readonly<Record<string, unknown>>): void {
  const questions = readinessObject(receipt.questions);
  const existing = readinessObject(receipt.existing);
  const required = ['q12', 'q13', 'q15', 'q16', 'q17', 'q18', 'q19', 'q20'].map((id) =>
    readinessObject(questions[id]),
  );
  const old = ['q01', 'q05', 'q14', 'outbound'].map((id) => readinessObject(existing[id]));
  if ([...required, ...old].some((proof) => proof.supported !== true)) {
    throw new Error('A required whole-question or earlier source proof is unsupported.');
  }
  for (const proof of required) {
    const clauses = readinessObject(proof.clauses);
    if (
      Object.keys(clauses).length === 0 ||
      Object.values(clauses).some((clause) => clause !== true)
    ) {
      throw new Error('A required whole-question proof clause is missing or unsupported.');
    }
  }
}
