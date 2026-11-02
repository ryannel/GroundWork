import type { Interaction, InterfaceContract, KnowledgeRecord, Shape } from './knowledge.generated';

type Records = ReadonlyMap<string, KnowledgeRecord>;
type Part = InterfaceContract['request'][number];
type Binding = Interaction['requestBindings'][number];
type PathResult = 'valid' | 'invalid' | 'unknown';

function missingFieldPath(shape: Shape, unknown: PathResult): PathResult {
  if (shape.additionalProperties === false) return 'invalid';
  if (shape.additionalProperties === undefined && shape.completeness === 'closed') return 'invalid';
  return unknown;
}

function shapePath(byId: Records, shapeId: string | null, path: readonly string[]): PathResult {
  if (path.length === 0) return 'valid';
  const shape = shapeId === null ? undefined : byId.get(shapeId);
  if (shape?.kind !== 'shape') return 'unknown';
  const unknown = shape.gaps.length > 0 ? 'valid' : 'unknown';
  if (shape.container === 'array') return unknown;
  const field = shape.fields.find((item) => item.name === path[0]);
  if (field === undefined) return missingFieldPath(shape, unknown);
  return path.length === 1 ? 'valid' : shapePath(byId, field.shape ?? null, path.slice(1));
}

function partPath(binding: Binding, part: Part, byId: Records): PathResult {
  if (part.presence === 'none') return 'invalid';
  const result = shapePath(byId, part.shape, binding.path);
  const shape = part.shape === null ? undefined : byId.get(part.shape);
  const hasGap = part.gaps.length > 0 || (shape?.kind === 'shape' && shape.gaps.length > 0);
  return result === 'unknown' && hasGap ? 'valid' : result;
}

function bindingProblems(
  record: Interaction,
  binding: Binding,
  context: { readonly parts: readonly Part[]; readonly byId: Records },
): string[] {
  // Selection and result describe source arguments/results, whose wire placement can be unknown.
  if (binding.part === 'selection' || binding.part === 'result') return [];
  const parts = context.parts.filter((part) => part.part === binding.part);
  const results = parts.map((part) => partPath(binding, part, context.byId));
  if (results.includes('valid')) return [];
  if (results.length > 0 && results.every((result) => result === 'invalid')) {
    return [`${record.id}: transferred binding path contradicts its contract schema`];
  }
  return record.gaps.length > 0
    ? []
    : [`${record.id}: unresolved transferred binding path requires an explicit schema gap`];
}

export function interactionBindingProblems(record: Interaction, byId: Records): string[] {
  const contract = byId.get(record.contract);
  if (contract?.kind !== 'interface_contract') return [];
  return [
    ...record.requestBindings.flatMap((binding) =>
      bindingProblems(record, binding, { parts: contract.request, byId }),
    ),
    ...record.responseBindings.flatMap((binding) =>
      bindingProblems(record, binding, {
        parts: contract.responses.map((response) => response.body),
        byId,
      }),
    ),
  ];
}
