import type { ReadinessQuery, RepositoryReadinessInput } from './repository-readiness-types';

function positive(value: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= maximum;
}
function validLimits(limits: ReadinessQuery['limits']): boolean {
  return [
    positive(limits.maxRecords, 8192),
    positive(limits.maxBytes, 33_554_432),
    positive(limits.maxRecordsPerPage, 4),
    positive(limits.maxPageBytes, 65_536),
    positive(limits.idsPerRequest, 32),
  ].every(Boolean);
}
function queryComplete(query: ReadinessQuery): boolean {
  const records = query.returnedRecordIds;
  return [
    validLimits(query.limits),
    query.artifactVerified,
    positive(query.selectedRecords, query.limits.maxRecords),
    records.length === query.selectedRecords,
    new Set(records).size === records.length,
    records.every((id) => id.trim().length > 0),
    positive(query.pages, query.selectedRecords),
    query.pages * query.limits.maxRecordsPerPage >= records.length,
    positive(query.bytes, query.limits.maxBytes),
    query.missing === 0,
    query.oversized === 0,
    query.omitted === 0,
  ].every(Boolean);
}
export function readinessEntryErrors(input: RepositoryReadinessInput): readonly string[] {
  const entries = input.catalogue.entries;
  const ids = entries.map((entry) => entry.id);
  const errors: string[] = [];
  if (
    entries.length === 0 ||
    new Set(ids).size !== ids.length ||
    entries.some((entry) => entry.id.trim().length === 0 || entry.planEntryId !== entry.id)
  ) {
    errors.push('Automatic entry catalogue is empty, duplicated or has missing query plans.');
  }
  const queries = input.catalogue.queries;
  if (queries.length < 2 || new Set(queries.map((query) => query.entryId)).size < 2) {
    errors.push('At least two distinct entry query artefacts are required.');
  }
  for (const query of queries) {
    if (!ids.includes(query.entryId) || !queryComplete(query)) {
      errors.push(
        `${query.entryId}: entry query is unverified, incomplete or outside fixed retrieval caps.`,
      );
    }
  }
  return errors;
}
