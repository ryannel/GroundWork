import { referencesFor, type CheckContext } from './check-scan-answers';
import type { ActorConstraint } from './scan.generated';

function constraintInputs(constraint: ActorConstraint, context: CheckContext): string[] {
  const expression = constraint.expression;
  const references = referencesFor(context.records);
  if (expression.kind === 'predicate') {
    return references([expression.source], ['source'], constraint.id);
  }
  const ids = expression.kind === 'not' ? [expression.constraint] : expression.constraints;
  const errors = references(ids, ['actor_constraint'], constraint.id);
  if (ids.includes(constraint.id)) {
    errors.push(`${constraint.id}: self-referencing actor constraint`);
  }
  if (constraint.authority === 'enforcement_bound') {
    for (const id of ids) {
      const child = context.records.get(id);
      if (child?.kind === 'actor_constraint' && child.authority !== 'enforcement_bound') {
        errors.push(`${constraint.id}: enforcement requires bound child constraints`);
      }
    }
  }
  return errors;
}

export function actorConstraintErrors(context: CheckContext): string[] {
  return (context.document.actorConstraints ?? []).flatMap((constraint) => {
    const errors = constraintInputs(constraint, context);
    if (
      constraint.authority !== 'enforcement_bound' ||
      constraint.expression.kind !== 'predicate'
    ) {
      return errors;
    }
    const source = context.records.get(constraint.expression.source);
    const host = source?.kind === 'source' ? context.records.get(source.host) : undefined;
    if (host?.kind !== 'host' || host.environment === 'browser' || host.environment === 'unknown') {
      errors.push(`${constraint.id}: client availability cannot establish server enforcement`);
    }
    return errors;
  });
}
