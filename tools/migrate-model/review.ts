import { createHash } from 'node:crypto';

import { serialise } from '@/../tools/rebuild/snapshots';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

export interface ReviewRow {
  readonly key: string;
  readonly fingerprint: string;
  readonly status: string;
  readonly [field: string]: unknown;
}
export interface MigrationReview {
  readonly add: (
    family: string,
    key: string,
    source: unknown,
    detail: Readonly<Record<string, unknown>>,
  ) => unknown;
  readonly rows: () => Readonly<Record<string, readonly ReviewRow[]>>;
  readonly pending: (family: string) => number;
}
export function fingerprint(value: unknown): string {
  return createHash('sha256').update(serialise(value)).digest('hex');
}
export function migrationReview(accepted: readonly unknown[] = []): MigrationReview {
  const approvals = new Map<string, ReviewRow>();
  const recorded = new Map<string, Map<string, ReviewRow>>();
  for (const file of accepted) {
    for (const value of modelList(file)) {
      const row = modelRecord(value);
      const key = modelText(row?.key);
      const hash = modelText(row?.fingerprint);
      if (row?.status !== 'accepted' || key === null || hash === null) continue;
      if (approvals.has(key)) throw new Error(`Repeated accepted review key: ${key}`);
      approvals.set(key, { ...row, key, fingerprint: hash, status: 'accepted' });
    }
  }
  return {
    add: (family, key, source, detail) => {
      const hash = fingerprint(source);
      const approval = approvals.get(key);
      if (approval !== undefined && approval.fingerprint !== hash) {
        throw new Error(`Stale acceptance: ${key}`);
      }
      const row = {
        ...detail,
        key,
        fingerprint: hash,
        status: approval?.status ?? 'pending',
        ...(approval === undefined ? {} : { accepted: approval }),
      };
      let rows = recorded.get(family);
      if (rows === undefined) {
        rows = new Map();
        recorded.set(family, rows);
      }
      const previous = rows.get(key);
      if (previous !== undefined && serialise(previous) !== serialise(row)) {
        throw new Error(`Ambiguous review key: ${key}`);
      }
      rows.set(key, row);
      return approval;
    },
    rows: () =>
      Object.fromEntries(
        [...recorded]
          .toSorted(([a], [b]) => a.localeCompare(b))
          .map(([family, rows]) => [
            family,
            [...rows.values()].toSorted((a, b) => a.key.localeCompare(b.key)),
          ]),
      ),
    pending: (family) =>
      [...(recorded.get(family)?.values() ?? [])].filter((row) => row.status !== 'accepted').length,
  };
}

/** Keep repeated validation failures grouped by cause, alongside the complete review rows. */
export function reviewSummary(
  rows: Readonly<Record<string, readonly ReviewRow[]>>,
): Readonly<Record<string, unknown>> {
  const families = Object.fromEntries(
    Object.entries(rows).map(([family, values]) => [
      family,
      { total: values.length, pending: values.filter((row) => row.status !== 'accepted').length },
    ]),
  );
  const errors = new Map<string, number>();
  for (const row of rows.evidence ?? []) {
    for (const error of modelList(row.errors)) {
      const value = modelRecord(error);
      const key = serialise({
        family: row.family,
        path: value?.instancePath,
        keyword: value?.keyword,
        params: value?.params,
      }).trim();
      errors.set(key, (errors.get(key) ?? 0) + 1);
    }
  }
  return {
    families,
    validationCauses: Object.fromEntries([...errors].toSorted(([a], [b]) => a.localeCompare(b))),
  };
}
