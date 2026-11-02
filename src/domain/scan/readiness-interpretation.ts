import { interpretationErrors } from './interpretation-check';
import type { Claim, Run } from './interpretation.generated';
import type { RepositoryReadinessInput } from './repository-readiness-types';

function visibleClaim(claim: Claim): boolean {
  return [
    [claim.label].includes('inferred'),
    claim.reasoning.trim().length > 0,
    claim.limitations.length > 0,
    ['low', 'medium', 'high'].includes(claim.confidence),
  ].every(Boolean);
}
function validUsage(usage: Run['usage']): boolean {
  return usage.state === 'measured'
    ? [
        Number.isSafeInteger(usage.calls),
        usage.calls > 0,
        Number.isSafeInteger(usage.input_tokens),
        usage.input_tokens >= 0,
        Number.isSafeInteger(usage.output_tokens),
        usage.output_tokens >= 0,
      ].every(Boolean)
    : [
        Number.isSafeInteger(usage.calls_lower_bound),
        usage.calls_lower_bound > 0,
        usage.reason.trim().length > 0,
      ].every(Boolean);
}
export function readinessInterpretationErrors(input: RepositoryReadinessInput): readonly string[] {
  const { document, snapshots } = input.interpretation;
  const errors = [...interpretationErrors(document, snapshots)];
  if (document.state !== 'complete') errors.push('Best-effort interpretation is not complete.');
  const targets = document.contexts
    .filter((context) =>
      [
        context.kind === 'scan_snapshot',
        context.role === 'target',
        context.kind === 'scan_snapshot' && context.repo === input.expectations.repo,
        context.kind === 'scan_snapshot' && context.commit === input.expectations.commit,
      ].every(Boolean),
    )
    .map((context) => context.id);
  const groundedAttempts = document.attempts.every((attempt) =>
    document.runs.some(
      (run) =>
        run.id === attempt.run_id && targets.some((id) => run.input_context_ids.includes(id)),
    ),
  );
  if (targets.length === 0 || !groundedAttempts) {
    errors.push(
      'Interpretation needs a verified target scan context supplied to every attempted area for this repository and commit.',
    );
  }
  for (const claim of document.claims) {
    if (!visibleClaim(claim)) {
      errors.push(
        `${claim.id}: inferred label, rationale, confidence and limitations must remain visible.`,
      );
    }
  }
  for (const run of document.runs) {
    if (!validUsage(run.usage)) {
      errors.push(
        `${run.id}: interpretation usage is neither measured positive usage nor explicitly unknown positive usage.`,
      );
    }
  }
  return errors;
}
