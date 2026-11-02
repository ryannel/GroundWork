import { captureBindingProblems } from './capture-bindings';
import { checkAsyncKnowledge } from './check-async-knowledge';
import { interactionProblems } from './check-interaction';
import { checkRuntimeKnowledge } from './check-runtime-knowledge';
import { ownershipProblems } from './knowledge-ownership';
import { referenceKindProblems } from './knowledge-reference-kinds';
import { recordReferences } from './knowledge-references';
import type { KnowledgeBundle, KnowledgeRecord, Resolution } from './knowledge.generated';
import { receiverBindingProblems } from './receiver-bindings';
import { returnKindProblems } from './return-kind';
import { runtimeBundleProblems } from './runtime-bundle';

type Records = ReadonlyMap<string, KnowledgeRecord>;

function waitingProblems(record: KnowledgeRecord): string[] {
  return record.kind === 'operation' && record.waitsFor !== undefined && record.action !== 'call'
    ? [`${record.id}: waiting boundary requires a call`]
    : [];
}

function operationProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'operation' || record.action !== 'call') return [];
  const resolution = record.resolution === null ? undefined : byId.get(record.resolution);
  if (resolution?.kind !== 'resolution' || resolution.owner !== record.owner) {
    return [`${record.id}: resolution must belong to caller`];
  }
  if (resolution.target === null) return [];
  const target = byId.get(resolution.target);
  if (target?.kind !== 'implementation') return [`${record.id}: target must be an implementation`];
  const parameters = target.parameters.map((id) => byId.get(id));
  const supplied = record.bindings.map((binding) => binding.parameter);
  if (
    new Set(supplied).size !== supplied.length ||
    target.parameters.some((id) => !supplied.includes(id))
  ) {
    return [`${record.id}: formal bindings must be complete and unique`];
  }
  return record.bindings.flatMap((binding) =>
    parameters.some(
      (parameter) => parameter?.kind === 'value' && parameter.id === binding.parameter,
    )
      ? []
      : [`${record.id}: unknown formal ${binding.parameter}`],
  );
}

function nullableRecord(byId: Records, id: string | null): KnowledgeRecord | undefined {
  return id === null ? undefined : byId.get(id);
}

function verifiedProblems(record: Resolution, byId: Records): string[] {
  const binding = nullableRecord(byId, record.binding);
  const artifact = nullableRecord(byId, record.requestedArtifact);
  const target = nullableRecord(byId, record.target);
  const invalid = `${record.id}: verified resolution requires exact artifact digest and source binding`;
  if (binding?.kind !== 'artifact_source_binding' || binding.status !== 'exact') return [invalid];
  if (artifact?.kind !== 'artifact' || artifact.digest === null) return [invalid];
  if (target?.kind !== 'implementation' || binding.source !== target.scope) return [invalid];
  return binding.artifact === artifact.id ? [] : [invalid];
}

function resolutionProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'resolution') return [];
  if ((record.basis === 'unresolved') !== (record.target === null)) {
    return [`${record.id}: unresolved targets must remain null`];
  }
  if (record.basis === 'artifact_verified') return verifiedProblems(record, byId);
  if (record.basis !== 'source_local') return [];
  const target = nullableRecord(byId, record.target);
  const owner = byId.get(record.owner);
  const local = target?.kind === 'implementation' && owner?.kind === 'implementation';
  return local && target.scope === owner.scope
    ? []
    : [`${record.id}: local resolution cannot cross source revisions`];
}

function scopeProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind === 'evidence') {
    return record.lines[0] > record.lines[1] ? [`${record.id}: reversed source lines`] : [];
  }
  if (record.kind !== 'transition' && record.kind !== 'flow') return [];
  const expected = record.kind === 'transition' ? 'operation' : 'value';
  const ends = [byId.get(record.from), byId.get(record.to)];
  const invalid = ends.some(
    (end) => end?.kind !== expected || !('owner' in end) || end.owner !== record.owner,
  );
  return invalid ? [`${record.id}: endpoints must share owning implementation`] : [];
}

export function checkKnowledge(bundle: KnowledgeBundle): string[] {
  const byId = new Map(bundle.records.map((record) => [record.id, record]));
  const errors = byId.size === bundle.records.length ? [] : ['Duplicate revision record IDs'];
  for (const record of bundle.records) {
    for (const reference of recordReferences(record)) {
      if (!byId.has(reference)) errors.push(`${record.id}: missing reference ${reference}`);
    }
    errors.push(
      ...scopeProblems(record, byId),
      ...referenceKindProblems(record, byId),
      ...ownershipProblems(record, byId),
      ...resolutionProblems(record, byId),
      ...operationProblems(record, byId),
      ...waitingProblems(record),
      ...captureBindingProblems(record, byId),
      ...receiverBindingProblems(record, byId),
      ...returnKindProblems(record, byId),
      ...checkAsyncKnowledge(record, byId),
      ...checkRuntimeKnowledge(record, byId),
      ...interactionProblems(record, byId),
    );
  }
  return [...errors, ...runtimeBundleProblems(bundle)];
}
