import type { Context, Evidence, ObservedReference } from './interpretation.generated';
import { scanRecords, type ScanRecord } from './scan-records';
import type { ScanDocument } from './scan.generated';

export type InterpretationSnapshot =
  | {
      readonly kind: 'scan_snapshot';
      readonly id: string;
      readonly sha256: string;
      readonly document: ScanDocument;
    }
  | {
      readonly kind: 'context_snapshot';
      readonly id: string;
      readonly sha256: string;
      readonly uri: string;
      readonly revision: string;
      readonly text: string;
    };

function scanContextErrors(
  context: Extract<Context, { readonly kind: 'scan_snapshot' }>,
  snapshot: Extract<InterpretationSnapshot, { readonly kind: 'scan_snapshot' }>,
): string[] {
  const matches =
    snapshot.document.id === context.scan_id &&
    snapshot.document.sources.length > 0 &&
    snapshot.document.sources.every(
      (source) => source.repo === context.repo && source.commit === context.commit,
    );
  return matches ? [] : [`${context.id}: scan identity or repository revision does not match`];
}
export function contextErrors(
  context: Context,
  snapshot: InterpretationSnapshot | undefined,
): string[] {
  if (snapshot?.kind !== context.kind) {
    return [`${context.id}: context snapshot kind does not match supplied evidence`];
  }
  if (snapshot.sha256 !== context.sha256) {
    return [`${context.id}: context snapshot digest does not match supplied evidence`];
  }
  if (context.kind === 'scan_snapshot' && snapshot.kind === 'scan_snapshot') {
    return scanContextErrors(context, snapshot);
  }
  if (context.kind === 'context_snapshot' && snapshot.kind === 'context_snapshot') {
    return context.uri === snapshot.uri && context.revision === snapshot.revision
      ? []
      : [`${context.id}: context URI or revision does not match`];
  }
  return [];
}
function observedRecord(
  snapshot: InterpretationSnapshot | undefined,
  id: string,
): ScanRecord | undefined {
  return snapshot?.kind === 'scan_snapshot'
    ? scanRecords(snapshot.document).find((record) => record.id === id)
    : undefined;
}
function namedSources(value: unknown, key = ''): readonly string[] {
  const sourceKey =
    [
      'source',
      'sources',
      'source_ids',
      'support',
      'from',
      'to',
      'call',
      'caller',
      'receiver',
      'target',
    ].includes(key) ||
    key.endsWith('_source') ||
    key.endsWith('_sources');
  if (typeof value === 'string') return sourceKey ? [value] : [];
  if (Array.isArray(value)) return value.flatMap((item: unknown) => namedSources(item, key));
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([name, item]: readonly [string, unknown]) =>
    namedSources(item, name),
  );
}
export function referenceErrors(
  reference: ObservedReference,
  snapshots: readonly InterpretationSnapshot[],
): string[] {
  const snapshot = snapshots.find((item) => item.id === reference.context_id);
  return observedRecord(snapshot, reference.record_id)
    ? []
    : [`${reference.record_id}: observed record is missing from its context`];
}
function contextualEvidenceErrors(
  evidence: Extract<Evidence, { readonly kind: 'context_snapshot' }>,
  snapshot: InterpretationSnapshot,
): string[] {
  if (snapshot.kind !== 'context_snapshot') {
    return [`${evidence.context_id}: contextual evidence is not a document snapshot`];
  }
  const [start, end] = evidence.lines;
  return start <= end && end <= snapshot.text.split('\n').length
    ? []
    : [`${evidence.context_id}: contextual evidence lines are outside the snapshot`];
}
function observedEvidenceErrors(
  evidence: Extract<Evidence, { readonly kind: 'observed_record' }>,
  context: Context,
  snapshot: InterpretationSnapshot,
): string[] {
  const record = observedRecord(snapshot, evidence.record_id);
  if (!record || snapshot.kind !== 'scan_snapshot' || context.kind !== 'scan_snapshot') {
    return [`${evidence.record_id}: observed evidence record is missing`];
  }
  const owned = new Set([
    ...namedSources(record),
    ...(record.kind === 'source' ? [record.id] : []),
  ]);
  return evidence.source_ids.flatMap((id) => {
    const source = snapshot.document.sources.find((item) => item.id === id);
    return source?.repo === context.repo && source.commit === context.commit && owned.has(id)
      ? []
      : [`${evidence.record_id}: source ${id} is not owned and pinned evidence`];
  });
}
export function evidenceErrors(
  evidence: Evidence,
  contexts: readonly Context[],
  snapshots: readonly InterpretationSnapshot[],
): string[] {
  const context = contexts.find((item) => item.id === evidence.context_id);
  const snapshot = snapshots.find((item) => item.id === evidence.context_id);
  if (!context || !snapshot) return [`${evidence.context_id}: evidence context is missing`];
  return evidence.kind === 'context_snapshot'
    ? contextualEvidenceErrors(evidence, snapshot)
    : observedEvidenceErrors(evidence, context, snapshot);
}
