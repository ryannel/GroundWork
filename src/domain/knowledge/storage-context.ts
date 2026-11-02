import type { KnowledgeRecord, StorageWrite } from './knowledge.generated';

type Records = ReadonlyMap<string, KnowledgeRecord>;
interface WriteReference {
  readonly id: string;
  readonly context: readonly string[];
}

function boundTarget(
  resolution: KnowledgeRecord | undefined,
  owner: string,
  byId: Records,
): string | null {
  if (
    resolution?.kind !== 'resolution' ||
    resolution.owner !== owner ||
    resolution.basis === 'unresolved' ||
    resolution.target === null
  ) {
    return null;
  }
  const target = byId.get(resolution.target);
  return target?.kind === 'implementation' ? target.id : null;
}
function callTarget(
  reference: { readonly id: string; readonly owner: string },
  byId: Records,
): string | null {
  const call = byId.get(reference.id);
  if (call?.kind !== 'operation' || call.action !== 'call' || call.owner !== reference.owner) {
    return null;
  }
  const resolution = call.resolution === null ? undefined : byId.get(call.resolution);
  return boundTarget(resolution, reference.owner, byId);
}
function invocationOwners(
  owner: string,
  context: readonly string[],
  byId: Records,
): readonly string[] | null {
  const owners = [owner];
  let current = owner;
  for (const id of context) {
    const target = callTarget({ id, owner: current }, byId);
    if (target === null) return null;
    current = target;
    owners.push(current);
  }
  return owners;
}

export function storageContextReferences(record: StorageWrite): string[] {
  return [
    ...(record.effectContext ?? []),
    ...(record.stagedContext ?? []),
    ...(record.acknowledgedContext ?? []),
    ...record.fields.flatMap((field) => field.context ?? []),
  ];
}

function referenceOwners(
  record: StorageWrite,
  reference: WriteReference,
  byId: Records,
): readonly string[] | null {
  const owners = invocationOwners(record.owner, reference.context, byId);
  const target = byId.get(reference.id);
  return target !== undefined && 'owner' in target && target.owner === owners?.at(-1)
    ? owners
    : null;
}

function componentHosts(owner: string, byId: Records): readonly string[] {
  return [...byId.values()].flatMap((record) =>
    record.kind === 'execution_binding' && record.implementation === owner
      ? [record.component]
      : [],
  );
}
function sameHost(owners: readonly string[], byId: Records): boolean {
  const first = owners[0];
  if (first === undefined) return false;
  return componentHosts(first, byId).some((component) =>
    owners.every((owner) => componentHosts(owner, byId).includes(component)),
  );
}
function prefix(path: readonly string[], complete: readonly string[]): boolean {
  return path.length <= complete.length && path.every((id, index) => complete[index] === id);
}

/** Contexts are relative to this orchestration invocation, not the enclosing query root. */
export function storageContextProblems(record: StorageWrite, byId: Records): string[] {
  const effect = record.effectContext ?? [];
  const staged = record.stagedContext ?? [];
  const acknowledged = record.acknowledgedContext ?? [];
  const references: readonly WriteReference[] = [
    { id: record.effect, context: effect },
    { id: record.stagedAt, context: staged },
    { id: record.acknowledgedAt, context: acknowledged },
    ...record.fields.map((field) => ({ id: field.value, context: field.context ?? [] })),
  ];
  const errors: string[] = [];
  const owners: string[] = [];
  for (const reference of references) {
    const resolved = referenceOwners(record, reference, byId);
    if (resolved === null) {
      errors.push(
        `${record.id}: ${reference.id} must share owning implementation or use a valid invocation context`,
      );
    } else owners.push(...resolved);
  }
  if (effect.length !== acknowledged.length || !prefix(effect, acknowledged)) {
    errors.push(`${record.id}: effect and acknowledgement must identify the same invocation`);
  }
  if (
    record.fields.some(
      (field) => !prefix(field.context ?? [], staged) && !prefix(field.context ?? [], effect),
    )
  ) {
    errors.push(`${record.id}: write field context must belong to staging or effect lineage`);
  }
  if (
    references.some((reference) => reference.context.length > 0) &&
    !sameHost([...new Set(owners)], byId)
  ) {
    errors.push(`${record.id}: write contexts must share a runtime component`);
  }
  return errors;
}
