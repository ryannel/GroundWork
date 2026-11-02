import { answerErrors, referencesFor, type CheckContext } from './check-scan-answers';
import type { ScanRecords } from './scan-records';
import type { LocalSummary, Operation, ScanDocument } from './scan.generated';

function hostErrors(source: string, host: string, context: CheckContext): string[] {
  const record = context.records.get(source);
  return record?.kind === 'source' && record.host !== host
    ? [`${source}: source/host mismatch`]
    : [];
}

function branchErrors(operation: Operation, summary: LocalSummary): string[] {
  if (operation.kind !== 'control') return [];
  const ids = new Set(summary.operations.map((item) => item.id));
  return [...operation.consequent, ...operation.otherwise]
    .filter((target) => !ids.has(target))
    .map(() => `${operation.id}: branch target outside local summary`);
}

function operationErrors(
  operation: Operation,
  summary: LocalSummary,
  context: CheckContext,
): string[] {
  const references = referencesFor(context.records);
  const errors = [
    ...references([operation.source], ['source'], operation.id),
    ...hostErrors(operation.source, summary.host, context),
    ...branchErrors(operation, summary),
  ];
  if (operation.kind === 'call') {
    errors.push(
      ...answerErrors(operation.target, { owner: operation.id, kinds: ['summary'] }, context),
    );
  }
  if (operation.kind === 'opaque') {
    errors.push(...references([operation.frontier], ['frontier'], operation.id));
  }
  if (operation.kind === 'return' && operation.value.kind === 'unresolved') {
    errors.push(...references([operation.value.gap], ['gap'], operation.id));
  }
  return errors;
}

function hasUnexpandedOperation(summary: LocalSummary, records: ScanRecords): boolean {
  return summary.operations.some((operation) => {
    if (operation.kind === 'opaque') return true;
    if (operation.kind !== 'call') return false;
    if (operation.target.state !== 'supported') return true;
    return operation.target.value.some((id) => {
      const callee = records.get(id);
      return (
        callee?.kind !== 'summary' ||
        callee.frontiers.length > 0 ||
        callee.effects.state !== 'supported'
      );
    });
  });
}

export function executionErrors(document: ScanDocument, records: ScanRecords): string[] {
  const context = { document, records };
  return document.summaries.flatMap((summary) => {
    const references = referencesFor(records);
    const errors = [
      ...references([summary.host], ['host'], summary.id),
      ...references([summary.source], ['source'], summary.id),
      ...hostErrors(summary.source, summary.host, context),
      ...answerErrors(summary.effects, { owner: summary.id, kinds: ['effect'] }, context),
      ...summary.operations.flatMap((operation) => operationErrors(operation, summary, context)),
      ...summary.frontiers.flatMap((frontier) =>
        references([frontier.source], ['source'], frontier.id),
      ),
    ];
    if (
      (summary.frontiers.length > 0 || hasUnexpandedOperation(summary, records)) &&
      summary.effects.state === 'supported' &&
      summary.effects.value.length === 0
    ) {
      errors.push(`${summary.id}: unexpanded frontier cannot establish no effects`);
    }
    return errors;
  });
}
