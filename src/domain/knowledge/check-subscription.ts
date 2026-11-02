import type { KnowledgeRecord, Subscription } from './knowledge.generated';

export function subscriptionProblems(record: KnowledgeRecord): string[] {
  if (record.kind !== 'subscription') return [];
  const errors = headerProblems(record);
  if (record.headerFilter === 'unresolved' && record.gaps.length === 0) {
    errors.push(`${record.id}: unresolved header filters require a gap`);
  }
  return errors;
}

function headerProblems(record: Subscription): string[] {
  const filter = record.headerFilter ?? 'equals';
  if (filter === 'equals') {
    return record.header !== null && record.messageType !== null
      ? []
      : [`${record.id}: exact header filters require a header and message type`];
  }
  if (filter === 'present') {
    return record.header !== null && record.messageType === null
      ? []
      : [`${record.id}: presence filters require a header without an exact value`];
  }
  return record.header === null && record.messageType === null
    ? []
    : [`${record.id}: absent or unresolved header filters cannot assert a header value`];
}
