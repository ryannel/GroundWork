import {
  evidenceErrors,
  referenceErrors,
  type InterpretationSnapshot,
} from './interpretation-context';
import type { Claim, Context, EntityReference, Evidence, Run } from './interpretation.generated';

interface ClaimInput {
  readonly claims: readonly Claim[];
  readonly contexts: readonly Context[];
  readonly runs: readonly Run[];
  readonly snapshots: readonly InterpretationSnapshot[];
}
function claimEntities(claim: Claim): readonly EntityReference[] {
  if (claim.kind === 'purpose') return [claim.subject];
  return claim.kind === 'relationship' ? [claim.from, claim.to] : [];
}
function claimReferences(claim: Claim): readonly string[] {
  const refs = [...claim.dependencies];
  if ((claim.kind === 'action' || claim.kind === 'journey') && claim.actor !== null) {
    refs.push(claim.actor);
  }
  if (claim.kind === 'journey') refs.push(...claim.steps.map((step) => step.action));
  for (const entity of claimEntities(claim)) {
    if (entity.kind === 'inferred_claim') refs.push(entity.claim_id);
  }
  return refs;
}
function entityErrors(entity: EntityReference, input: ClaimInput): string[] {
  if (entity.kind === 'inferred_claim') return [];
  return entity.kind === 'observed_record'
    ? referenceErrors(entity, input.snapshots)
    : evidenceErrors(entity, input.contexts, input.snapshots);
}
function claimEvidence(claim: Claim): readonly Evidence[] {
  return claim.kind === 'action' ? [...claim.support, ...claim.entrypoints] : claim.support;
}
function supportErrors(claim: Claim, input: ClaimInput): string[] {
  const run = input.runs.find((entry) => entry.id === claim.run_id);
  const errors = run ? [] : [`${claim.id}: interpretation run is missing`];
  const evidence = claimEvidence(claim);
  for (const item of evidence) {
    errors.push(...evidenceErrors(item, input.contexts, input.snapshots));
  }
  const entityContexts = claimEntities(claim).flatMap((entity) =>
    entity.kind === 'inferred_claim' ? [] : [entity.context_id],
  );
  for (const id of [...evidence.map((item) => item.context_id), ...entityContexts]) {
    if (run && !run.input_context_ids.includes(id)) {
      errors.push(`${claim.id}: cited context was not an input to its run`);
    }
  }
  return errors;
}
function typedReferenceErrors(claim: Claim, claims: readonly Claim[]): string[] {
  const errors: string[] = [];
  for (const id of claimReferences(claim)) {
    if (!claims.some((entry) => entry.id === id)) {
      errors.push(`${claim.id}: inferred dependency ${id} is missing`);
    }
  }
  if (
    (claim.kind === 'action' || claim.kind === 'journey') &&
    claim.actor !== null &&
    !claims.some((entry) => entry.id === claim.actor && entry.kind === 'actor')
  ) {
    errors.push(`${claim.id}: actor must reference an actor claim`);
  }
  if (claim.kind === 'journey') {
    for (const step of claim.steps) {
      if (!claims.some((entry) => entry.id === step.action && entry.kind === 'action')) {
        errors.push(`${claim.id}: journey step must reference an action claim`);
      }
    }
  }
  return errors;
}
export function claimErrors(claim: Claim, input: ClaimInput): string[] {
  return [
    ...supportErrors(claim, input),
    ...typedReferenceErrors(claim, input.claims),
    ...claimEntities(claim).flatMap((entity) => entityErrors(entity, input)),
  ];
}
export function claimCycleErrors(claims: readonly Claim[]): string[] {
  const byId = new Map(claims.map((claim) => [claim.id, claim]));
  const state = new Map<string, 'visiting' | 'done'>();
  function visit(id: string): boolean {
    if (state.get(id) === 'visiting') return true;
    if (state.get(id) === 'done') return false;
    const claim = byId.get(id);
    if (!claim) return false;
    state.set(id, 'visiting');
    if (claimReferences(claim).some(visit)) return true;
    state.set(id, 'done');
    return false;
  }
  return claims.some((claim) => visit(claim.id))
    ? ['Interpretation claim dependencies are cyclic']
    : [];
}
