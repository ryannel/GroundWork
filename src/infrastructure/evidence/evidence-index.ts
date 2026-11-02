import 'server-only';

import { DatabaseSync, type StatementSync } from 'node:sqlite';

import { z } from 'zod';

import {
  type EvidenceQuery,
  limitOf,
  type LinkedRecord,
  matchExpression,
  type RecordDetail,
  type RecordRow,
  type RepositorySummary,
} from '@/application/evidence/evidence-query';
import { type EvidenceRecord, isEvidenceRecord } from '@/domain/evidence/evidence';
import { pathIn, statOf } from '@/infrastructure/disk';

import { INDEX_FORMAT, INDEX_PATH } from './evidence-index-schema';

// Reads a workspace's evidence index, read-only. One connection per index file, kept open and reopened when a
// rebuild replaces the file; statements are prepared once.

type Row = Record<string, unknown>;
const ROW = `repository, id, family, kind, label, path, line_start, line_end`;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const number = (value: unknown): number | null => (typeof value === 'number' ? value : null);

const recordRow = (row: Row): RecordRow => ({
  repository: text(row.repository),
  id: text(row.id),
  family: text(row.family),
  kind: text(row.kind),
  label: text(row.label),
  path: typeof row.path === 'string' ? row.path : null,
  lineStart: number(row.line_start),
  lineEnd: number(row.line_end),
});

const summaryShape = z.object({
  name: z.string(),
  repo: z.string(),
  commit: z.string(),
  scannedAt: z.string(),
  language: z.string().nullable(),
  passes: z.array(z.enum(['source', 'discovery'])),
  records: z.number(),
  families: z.record(z.string(), z.number()),
});
const summary = (row: Row): RepositorySummary => summaryShape.parse(JSON.parse(text(row.summary)));

const evidenceRecord = (json: unknown): EvidenceRecord => {
  const record: unknown = JSON.parse(text(json));
  if (!isEvidenceRecord(record)) throw new Error('Corrupt evidence record row');
  return record;
};

const COLUMNS = ROW.split(', ')
  .map((column) => `r.${column}`)
  .join(', ');

type Statements = Readonly<
  Record<
    'repositories' | 'repository' | 'records' | 'record' | 'out' | 'in' | 'search' | 'meta',
    StatementSync
  >
>;

function statements(database: DatabaseSync): Statements {
  const sql = {
    repositories: 'SELECT summary FROM repositories ORDER BY name',
    repository: 'SELECT summary, discovery FROM repositories WHERE name = ?',
    records: `SELECT ${ROW} FROM records WHERE repository = ?1 AND (?2 IS NULL OR family = ?2) AND (?3 IS NULL OR kind = ?3) AND (?4 IS NULL OR path = ?4) ORDER BY path, line_start, label, id LIMIT ?5 OFFSET ?6`,
    record: `SELECT rowid, ${ROW}, json FROM records WHERE repository = ? AND id = ?`,
    out: `SELECT l.field, ${COLUMNS} FROM links l JOIN records r ON r.rowid = l.target WHERE l.source = ? ORDER BY l.field, r.label LIMIT 500`,
    in: `SELECT l.field, ${COLUMNS} FROM links l JOIN records r ON r.rowid = l.source WHERE l.target = ? ORDER BY l.field, r.label LIMIT 500`,
    search: `SELECT ${COLUMNS} FROM search s JOIN records r ON r.rowid = s.rowid WHERE search MATCH ?1 AND (?2 IS NULL OR r.repository = ?2) AND (?3 IS NULL OR r.family = ?3) ORDER BY bm25(search, 10.0, 2.0, 1.0) LIMIT ?4`,
    meta: 'SELECT value FROM meta WHERE key = ?',
  };
  return {
    repositories: database.prepare(sql.repositories),
    repository: database.prepare(sql.repository),
    records: database.prepare(sql.records),
    record: database.prepare(sql.record),
    out: database.prepare(sql.out),
    in: database.prepare(sql.in),
    search: database.prepare(sql.search),
    meta: database.prepare(sql.meta),
  };
}

const linked = (row: Row): LinkedRecord => ({ field: text(row.field), record: recordRow(row) });

function queryOver(database: DatabaseSync): EvidenceQuery {
  const run = statements(database);
  const meta = (key: string): string => text(run.meta.get(key)?.value);
  if (meta('format') !== INDEX_FORMAT) throw new Error(`Evidence index is not ${INDEX_FORMAT}`);
  return {
    builtAt: meta('builtAt'),
    repositories: () => run.repositories.all().map(summary),
    repository(name) {
      const row = run.repository.get(name);
      if (row === undefined) return null;
      const discovery = typeof row.discovery === 'string' ? JSON.parse(row.discovery) : null;
      return { ...summary(row), discovery };
    },
    records(repository, filter = {}) {
      const values = [filter.family, filter.kind, filter.path].map((value) => value ?? null);
      const rows = run.records.all(
        repository,
        ...values,
        limitOf(filter.limit),
        filter.offset ?? 0,
      );
      return rows.map(recordRow);
    },
    record(repository, id): RecordDetail | null {
      const row = run.record.get(repository, id);
      const rowid = number(row?.rowid);
      if (row === undefined || rowid === null) return null;
      return {
        ...recordRow(row),
        record: evidenceRecord(row.json),
        linksOut: run.out.all(rowid).map(linked),
        linksIn: run.in.all(rowid).map(linked),
      };
    },
    search(words, filter = {}) {
      const match = matchExpression(words);
      if (match === null) return [];
      const scope = [filter.repository ?? null, filter.family ?? null];
      return run.search.all(match, ...scope, limitOf(filter.limit)).map(recordRow);
    },
  };
}

interface Open {
  readonly modified: number;
  readonly database: DatabaseSync;
  readonly query: EvidenceQuery;
}

const open = new Map<string, Open>();

/** The workspace's evidence, or null when its index has not been built. */
export async function evidenceIndex(workspace: string): Promise<EvidenceQuery | null> {
  const file = pathIn(workspace, ...INDEX_PATH);
  const stats = await statOf(file);
  const cached = open.get(file);
  if (cached !== undefined && cached.modified === stats?.mtimeMs) return cached.query;
  cached?.database.close();
  open.delete(file);
  if (stats === null) return null;
  const database = new DatabaseSync(file, { readOnly: true });
  try {
    const query = queryOver(database);
    open.set(file, { modified: stats.mtimeMs, database, query });
    return query;
  } catch (error) {
    database.close();
    throw error;
  }
}
