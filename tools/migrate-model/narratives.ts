import { rootId } from '@/domain/ids';
import { modelList, modelRecord } from '@/domain/workspace-model';

import { convertCitations, type MigrationCitations } from './citations';
import type { MigrationFile } from './files';
import type { MigrationReview } from './review';

type Node = Readonly<Record<string, unknown>>;
/** Authored model backing remains distinct from the actual code citations of the referenced facts. */
export function modelBackings(
  value: unknown,
  sources: ReadonlyMap<string, readonly unknown[]>,
): unknown {
  if (Array.isArray(value)) return value.map((item) => modelBackings(item, sources));
  const node = modelRecord(value);
  if (node === null) return value;
  const backed =
    node.evidence !== undefined &&
    (node.component !== undefined || (node.from !== undefined && node.to !== undefined));
  const converted = Object.fromEntries(
    Object.entries(node).map(([key, item]) => [
      key === 'evidence' && backed ? 'backs' : key,
      modelBackings(item, sources),
    ]),
  );
  if (!backed) return converted;
  const cites = modelList(node.evidence).flatMap((id) =>
    typeof id === 'string' ? (sources.get(id) ?? sources.get(rootId(id)) ?? []) : [],
  );
  const combined = [...new Set([...modelList(node.cites), ...cites])];
  return { ...converted, ...(combined.length === 0 ? {} : { cites: combined }) };
}
function missingBackings(value: unknown): readonly Node[] {
  if (Array.isArray(value)) return value.flatMap(missingBackings);
  const node = modelRecord(value);
  if (node === null) return [];
  return [
    ...(node.backs !== undefined && modelList(node.cites).length === 0 ? [node] : []),
    ...Object.values(node).flatMap(missingBackings),
  ];
}
export function migrateNarratives(
  file: MigrationFile,
  citations: MigrationCitations,
  sources: ReadonlyMap<string, readonly unknown[]>,
  review: MigrationReview,
): Node {
  const node = modelRecord(convertCitations(modelBackings(file.value, sources), citations));
  if (node === null) throw new Error(`${file.path}: expected narrative object.`);
  const proposed = { ...node, format: 2 };
  const missing = missingBackings(proposed);
  if (missing.length === 0) return proposed;
  const accepted = modelRecord(
    review.add('documents', `narrative/${file.path}`, file.value, {
      path: file.path,
      original: file.value,
      proposed,
      missing,
      reason:
        'Some model backing has no recorded code citation; reconcile it explicitly without inventing evidence.',
    }),
  );
  return modelRecord(accepted?.narrative) ?? proposed;
}
