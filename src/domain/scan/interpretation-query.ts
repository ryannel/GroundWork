import type { Claim, ScanInterpretation } from './interpretation.generated';

/** Display-ready claims retain their inference label, evidence, confidence and limitations. */
export function interpretationClaims(
  document: ScanInterpretation,
  kind?: Claim['kind'],
): {
  readonly label: 'inferred';
  readonly phase: ScanInterpretation['state'];
  readonly claims: readonly Claim[];
  readonly attempts: ScanInterpretation['attempts'];
  readonly runs: ScanInterpretation['runs'];
} {
  return {
    label: 'inferred',
    phase: document.state,
    claims: document.claims.filter((claim) => kind === undefined || claim.kind === kind),
    attempts: document.attempts,
    runs: document.runs,
  };
}

export function pendingInterpretation(
  id: string,
  context: ScanInterpretation['contexts'][number],
): ScanInterpretation {
  return {
    format: 'scan-interpretation/v1',
    id,
    state: 'pending',
    contexts: [context],
    runs: [],
    claims: [],
    attempts: [],
  };
}
