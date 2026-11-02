import { answerErrors, referencesFor, type CheckContext } from './check-scan-answers';
import type { ScanRecords } from './scan-records';
import type { ActionExecutionBinding, Answer, ScanDocument } from './scan.generated';

function conditionErrors(answer: Answer, concern: string, context: CheckContext): string[] {
  const errors = answerErrors(answer, { owner: concern, kinds: ['actor_constraint'] }, context);
  if (answer.state !== 'supported') return errors;
  for (const id of answer.value) {
    const constraint = context.records.get(id);
    if (constraint?.kind === 'actor_constraint' && constraint.concern !== concern) {
      errors.push(`${id}: actor condition concern mismatch`);
    }
  }
  return errors;
}

function actionErrors(context: CheckContext): string[] {
  return context.document.actions.flatMap((action) => {
    const references = referencesFor(context.records);
    const errors = [
      ...references(action.actors, ['actor'], action.id),
      ...references(action.controls, ['control_binding'], action.id),
      ...references(action.outcomes, ['outcome'], action.id),
      ...answerErrors(action.input, { owner: action.id, kinds: ['contract'] }, context),
      ...answerErrors(action.executions, { owner: action.id, kinds: ['execution'] }, context),
      ...Object.entries(action.conditions).flatMap(([concern, condition]) =>
        conditionErrors(condition, concern, context),
      ),
    ];
    for (const id of [...action.controls, ...action.outcomes]) {
      const record = context.records.get(id);
      if (
        (record?.kind === 'control_binding' || record?.kind === 'outcome') &&
        record.action !== action.id
      ) {
        errors.push(`${action.id}: control/outcome belongs to another action`);
      }
    }
    return errors;
  });
}

function controlAndOutcomeErrors(context: CheckContext): string[] {
  const errors: string[] = [];
  const references = referencesFor(context.records);
  for (const control of context.document.controls) {
    errors.push(
      ...references([control.action], ['action'], control.id),
      ...references([control.surface], ['surface'], control.id),
      ...references([control.source], ['source'], control.id),
      ...answerErrors(
        control.availability,
        { owner: control.id, kinds: ['actor_constraint'] },
        context,
      ),
    );
    const surface = context.records.get(control.surface);
    if (surface?.kind === 'surface' && !surface.states.includes(control.state)) {
      errors.push(`${control.id}: control state is not on surface`);
    }
  }
  for (const outcome of context.document.outcomes) {
    errors.push(
      ...references([outcome.action], ['action'], outcome.id),
      ...answerErrors(outcome.effects, { owner: outcome.id, kinds: ['effect'] }, context),
      ...answerErrors(outcome.visibleState, { owner: outcome.id, kinds: ['surface'] }, context),
    );
    if (outcome.continuation.kind === 'navigate' || outcome.continuation.kind === 'stay') {
      const surface = context.records.get(outcome.continuation.surface);
      if (surface?.kind !== 'surface' || !surface.states.includes(outcome.continuation.state)) {
        errors.push(`${outcome.id}: continuation must select a surface state`);
      }
    }
  }
  return errors;
}

function localBindingErrors(binding: ActionExecutionBinding, context: CheckContext): string[] {
  if (binding.target.kind !== 'local') return [];
  const target = binding.target;
  const summary = context.records.get(target.summary);
  if (
    summary?.kind !== 'summary' ||
    summary.host !== binding.host ||
    !summary.operations.some((operation) => operation.id === target.operation)
  ) {
    return [`${binding.id}: local execution must match host and operation`];
  }
  return [];
}

function bindingErrors(context: CheckContext): string[] {
  return context.document.executions.flatMap((binding) => {
    const references = referencesFor(context.records);
    const errors = [
      ...references([binding.action], ['action'], binding.id),
      ...references([binding.host], ['host'], binding.id),
      ...references(
        [binding.operation],
        ['call', 'control', 'await', 'return', 'throw', 'opaque'],
        binding.id,
      ),
      ...references([binding.source], ['source'], binding.id),
      ...answerErrors(binding.guard, { owner: binding.id, kinds: ['control'] }, context),
      ...localBindingErrors(binding, context),
    ];
    const source = context.records.get(binding.source);
    if (source?.kind === 'source' && source.host !== binding.host) {
      errors.push(`${binding.id}: source/host mismatch`);
    }
    for (const mapping of binding.outcomeMappings) {
      const outcome = context.records.get(mapping.outcome);
      if (outcome?.kind !== 'outcome' || outcome.action !== binding.action) {
        errors.push(`${binding.id}: response/outcome action mismatch`);
      }
      errors.push(...references(mapping.support, ['source', 'derivation'], binding.id));
    }
    return errors;
  });
}

export function actorJourneyErrors(document: ScanDocument, records: ScanRecords): string[] {
  const context = { document, records };
  const references = referencesFor(records);
  const errors = [
    ...actionErrors(context),
    ...controlAndOutcomeErrors(context),
    ...bindingErrors(context),
  ];
  for (const journey of document.journeys) {
    errors.push(...references([journey.actor], ['actor'], journey.id));
    for (const step of journey.steps) {
      const action = records.get(step.action);
      const outcome = records.get(step.outcome);
      if (action?.kind !== 'action' || !action.actors.includes(journey.actor)) {
        errors.push(`${journey.id}: actor/action mismatch`);
      }
      if (outcome?.kind !== 'outcome' || outcome.action !== step.action) {
        errors.push(`${journey.id}: action/outcome mismatch`);
      }
    }
    for (const transition of journey.transitions) {
      errors.push(
        ...references([transition.from], ['outcome'], journey.id),
        ...references([transition.to], ['action'], journey.id),
        ...answerErrors(transition.guard, { owner: journey.id, kinds: ['control'] }, context),
      );
    }
  }
  return errors;
}
