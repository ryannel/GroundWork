import type {
  ActorConstraint,
  BindingRecord,
  FrameworkRecord,
  ScanDocument,
  SearchReceipt,
  SemanticRecord,
} from './scan.generated';

type RecordField =
  | 'sources'
  | 'rules'
  | 'derivations'
  | 'gaps'
  | 'obligations'
  | 'receipts'
  | 'hosts'
  | 'contracts'
  | 'effects'
  | 'summaries'
  | 'actors'
  | 'surfaces'
  | 'controls'
  | 'actions'
  | 'outcomes'
  | 'executions'
  | 'journeys';
export type ScanRecord =
  | ActorConstraint
  | FrameworkRecord
  | BindingRecord
  | SemanticRecord
  | SearchReceipt
  | ScanDocument[RecordField][number]
  | ScanDocument['summaries'][number]['operations'][number]
  | ScanDocument['summaries'][number]['frontiers'][number];

export function scanRecords(document: ScanDocument): ScanRecord[] {
  return [
    ...(document.framework ?? []),
    ...(document.bindings ?? []),
    ...(document.semantic ?? []),
    ...(document.searches ?? []),
    ...(document.actorConstraints ?? []),
    ...document.sources,
    ...document.rules,
    ...document.derivations,
    ...document.gaps,
    ...document.obligations,
    ...document.receipts,
    ...document.hosts,
    ...document.contracts,
    ...document.effects,
    ...document.summaries,
    ...document.actors,
    ...document.surfaces,
    ...document.controls,
    ...document.actions,
    ...document.outcomes,
    ...document.executions,
    ...document.journeys,
    ...document.summaries.flatMap((summary) => summary.operations),
    ...document.summaries.flatMap((summary) => summary.frontiers),
  ];
}

export type ScanRecordKind = ScanRecord['kind'];
export type ScanRecords = ReadonlyMap<string, ScanRecord>;

export function scanReference<K extends ScanRecordKind>(
  records: ScanRecords,
  id: string,
  kind: K,
): Extract<ScanRecord, { readonly kind: K }> | undefined {
  const record = records.get(id);
  if (record?.kind !== kind) return undefined;
  // A predicate preserves the discriminant without coercing an unchecked reference.
  return [record].find(
    (item): item is Extract<ScanRecord, { readonly kind: K }> => item.kind === kind,
  );
}
