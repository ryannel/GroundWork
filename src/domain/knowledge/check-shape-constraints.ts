import type { KnowledgeRecord } from './knowledge.generated';

export function shapeConstraintProblems(record: KnowledgeRecord): string[] {
  if (record.kind !== 'shape') return [];
  const errors: string[] = [];
  if (record.additionalProperties !== undefined && record.container !== 'object') {
    errors.push(`${record.id}: additional properties policy requires an object shape`);
  }
  for (const field of record.fields) {
    if (
      field.const !== undefined &&
      field.enum !== undefined &&
      !field.enum.includes(field.const)
    ) {
      errors.push(`${record.id}.${field.name}: constant must belong to its declared enum`);
    }
  }
  return errors;
}
