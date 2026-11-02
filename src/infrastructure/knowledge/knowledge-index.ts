import 'server-only';

import { DatabaseSync } from 'node:sqlite';

import { type KnowledgeReader, recordIndexes } from '@/domain/knowledge/knowledge-reader';
import type {
  KnowledgeBundle,
  KnowledgeRecord,
  KnowledgeSnapshot,
} from '@/domain/knowledge/knowledge.generated';

import { knowledgeDigest, knowledgeValidators } from './knowledge-format';
import { verifyKnowledgeSelection } from './knowledge-selection';

interface SnapshotInput {
  readonly manifest: KnowledgeSnapshot;
  readonly bundles: readonly KnowledgeBundle[];
}

const TABLES = `
CREATE TABLE IF NOT EXISTS snapshots (id TEXT PRIMARY KEY, manifest TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS members (snapshot TEXT NOT NULL, bundle TEXT NOT NULL, PRIMARY KEY(snapshot,bundle));
CREATE TABLE IF NOT EXISTS records (bundle TEXT NOT NULL, id TEXT NOT NULL, document TEXT NOT NULL, PRIMARY KEY(bundle,id));
CREATE TABLE IF NOT EXISTS adjacency (bundle TEXT NOT NULL, field TEXT NOT NULL, value TEXT NOT NULL, record TEXT NOT NULL, PRIMARY KEY(bundle,field,value,record));
CREATE INDEX IF NOT EXISTS reverse_adjacency ON adjacency(field,value,bundle,record);
`;

function writeBundle(database: DatabaseSync, bundle: KnowledgeBundle): string {
  const digest = knowledgeDigest(bundle);
  const recordRow = database.prepare('INSERT OR IGNORE INTO records VALUES(?,?,?)');
  const indexRow = database.prepare('INSERT OR IGNORE INTO adjacency VALUES(?,?,?,?)');
  for (const record of bundle.records) {
    recordRow.run(digest, record.id, JSON.stringify(record));
    const rows = [...recordIndexes(record)].flatMap(([field, values]) =>
      values.map((value) => [field, value]),
    );
    for (const [field, value] of rows) indexRow.run(digest, field ?? '', value ?? '', record.id);
  }
  return digest;
}

function publish(database: DatabaseSync, input: SnapshotInput): void {
  database.exec(TABLES);
  database.exec('BEGIN IMMEDIATE');
  try {
    for (const bundle of input.bundles) {
      const digest = writeBundle(database, bundle);
      database.prepare('INSERT OR IGNORE INTO members VALUES(?,?)').run(input.manifest.id, digest);
    }
    database
      .prepare('INSERT OR IGNORE INTO snapshots VALUES(?,?)')
      .run(input.manifest.id, JSON.stringify(input.manifest));
    database.exec('COMMIT');
  } catch (error) {
    if (database.isTransaction) database.exec('ROLLBACK');
    throw error;
  }
}

/** Transactional publication in a disposable index; a failed import cannot replace a prior snapshot. */
export async function importKnowledgeSnapshot(file: string, input: SnapshotInput): Promise<void> {
  const parse = await knowledgeValidators();
  parse.snapshot(input.manifest);
  for (const bundle of input.bundles) parse.bundle(bundle);
  verifyKnowledgeSelection(input);
  const database = new DatabaseSync(file);
  try {
    publish(database, input);
  } finally {
    database.close();
  }
}

interface OpenSnapshot {
  readonly reader: KnowledgeReader;
  readonly close: () => void;
}

export async function openKnowledgeSnapshot(file: string, snapshot: string): Promise<OpenSnapshot> {
  const parse = await knowledgeValidators();
  const database = new DatabaseSync(file, { readOnly: true });
  const manifest = database.prepare('SELECT manifest FROM snapshots WHERE id=?').get(snapshot);
  if (typeof manifest?.manifest !== 'string') {
    database.close();
    throw new Error('Unknown snapshot');
  }
  const selected = parse.snapshot(JSON.parse(manifest.manifest));
  if (selected.id !== snapshot) {
    database.close();
    throw new Error('Snapshot identity mismatch');
  }
  const get = database.prepare(
    'SELECT r.document FROM records r JOIN members m ON m.bundle=r.bundle WHERE m.snapshot=? AND r.id=?',
  );
  const select = database.prepare(
    'SELECT r.document FROM adjacency a JOIN records r ON r.bundle=a.bundle AND r.id=a.record JOIN members m ON m.bundle=a.bundle WHERE m.snapshot=? AND a.field=? AND a.value=? ORDER BY r.id',
  );
  const decode = (row: Record<string, unknown>): KnowledgeRecord => {
    if (typeof row.document !== 'string') throw new Error('Corrupt record row');
    return parse.record(JSON.parse(row.document));
  };
  const reader: KnowledgeReader = {
    snapshot,
    rules: selected.rules,
    get(id) {
      const row = get.get(snapshot, id);
      return row === undefined ? undefined : decode(row);
    },
    select(index, value) {
      return select.all(snapshot, index, value).map(decode);
    },
  };
  return {
    reader,
    close: () => {
      database.close();
    },
  };
}
