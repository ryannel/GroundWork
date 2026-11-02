import { claimCycleErrors, claimErrors } from './interpretation-claims';
import { contextErrors, type InterpretationSnapshot } from './interpretation-context';
import type { Attempt, ScanInterpretation } from './interpretation.generated';

const AREAS: readonly Attempt['area'][] = ['purpose', 'actor', 'action', 'journey', 'relationship'];
function attemptErrors(document: ScanInterpretation): string[] {
  return document.attempts.flatMap((attempt) => {
    const errors: string[] = [];
    if (!document.runs.some((run) => run.id === attempt.run_id)) {
      errors.push(`${attempt.area}: attempt run is missing`);
    }
    const proposed = attempt.outcome === 'claims_proposed';
    if (proposed !== attempt.claim_ids.length > 0) {
      errors.push(`${attempt.area}: attempt outcome and claim list disagree`);
    }
    for (const id of attempt.claim_ids) {
      if (
        !document.claims.some(
          (claim) =>
            claim.id === id && claim.kind === attempt.area && claim.run_id === attempt.run_id,
        )
      ) {
        errors.push(`${attempt.area}: attempted claim ${id} has a different kind or run`);
      }
    }
    return errors;
  });
}
function runErrors(document: ScanInterpretation): string[] {
  return document.runs.flatMap((run) => {
    const errors: string[] = [];
    if ((run.model.provenance === 'unknown') !== (run.model.name === null)) {
      errors.push(`${run.id}: model identity provenance disagrees with its name`);
    }
    if (
      run.started_at !== null &&
      run.finished_at !== null &&
      Date.parse(run.finished_at) < Date.parse(run.started_at)
    ) {
      errors.push(`${run.id}: interpretation run finishes before it starts`);
    }
    for (const id of run.input_context_ids) {
      if (!document.contexts.some((context) => context.id === id)) {
        errors.push(`${run.id}: input context ${id} is missing`);
      }
    }
    return errors;
  });
}
function phaseErrors(document: ScanInterpretation): string[] {
  const errors: string[] = [];
  if (
    document.state === 'pending' &&
    document.runs.length + document.claims.length + document.attempts.length > 0
  ) {
    errors.push('Pending interpretation cannot contain completed model work');
  }
  if (document.state !== 'pending' && document.runs.length === 0) {
    errors.push('Started interpretation needs explicit model run provenance and usage');
  }
  if (document.state !== 'complete') return errors;
  for (const area of AREAS) {
    if (!document.attempts.some((attempt) => attempt.area === area)) {
      errors.push(`${area}: complete interpretation needs an explicit best-effort attempt`);
    }
  }
  for (const claim of document.claims) {
    if (!document.attempts.some((attempt) => attempt.claim_ids.includes(claim.id))) {
      errors.push(`${claim.id}: claim is not included in an attempt`);
    }
  }
  return errors;
}
function duplicateErrors(
  document: ScanInterpretation,
  snapshots: readonly InterpretationSnapshot[],
): string[] {
  const collections = [document.contexts, document.runs, document.claims, snapshots];
  return collections.flatMap((records) =>
    new Set(records.map((record) => record.id)).size === records.length
      ? []
      : ['Interpretation identities are duplicated'],
  );
}
export function interpretationErrors(
  document: ScanInterpretation,
  snapshots: readonly InterpretationSnapshot[],
): string[] {
  const contexts = document.contexts.flatMap((context) =>
    contextErrors(
      context,
      snapshots.find((snapshot) => snapshot.id === context.id),
    ),
  );
  const claims = document.claims.flatMap((claim) => claimErrors(claim, { ...document, snapshots }));
  return [
    ...duplicateErrors(document, snapshots),
    ...contexts,
    ...claims,
    ...claimCycleErrors(document.claims),
    ...attemptErrors(document),
    ...runErrors(document),
    ...phaseErrors(document),
  ];
}
