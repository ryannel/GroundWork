import 'server-only';

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync, type StatementSync } from 'node:sqlite';

import { citedLines, indexedRecord, recordLinks } from '@/application/evidence/evidence-index-rows';
import { type EvidenceRecord, fieldsOf, textOf } from '@/domain/evidence/evidence';
import {
  INDEX_FORMAT,
  INDEX_INDEXES,
  INDEX_PATH,
  INDEX_TABLES,
  UNSEARCHED_FAMILIES,
} from '@/infrastructure/evidence/evidence-index-schema';
import { inTurn } from '@/shared/in-turn';

import { analysisFolder, evidenceRepositories, readRecords, recordFiles } from './evidence-files';

// Builds <workspace>/.groundwork/evidence.sqlite from <workspace>/evidence/ and .groundwork/analysis/, whole, in one transaction, into a
// new file that then replaces the old by rename.

interface Statements {
  readonly record: StatementSync;
  readonly search: StatementSync;
  readonly link: StatementSync;
  readonly repository: StatementSync;
}

const prepared = (database: DatabaseSync): Statements => ({
  record: database.prepare(
    'INSERT INTO records (repository,id,family,kind,label,path,line_start,line_end,json) VALUES (?,?,?,?,?,?,?,?,?)',
  ),
  search: database.prepare('INSERT INTO search (rowid,label,path,text) VALUES (?,?,?,?)'),
  link: database.prepare('INSERT OR IGNORE INTO links VALUES (?,?,?)'),
  repository: database.prepare('INSERT INTO repositories VALUES (?,?,?,?)'),
});

type FamilyFile = readonly [family: string, file: string];

/** A repository's record files: its evidence, then its call-level analysis from the cache. */
async function familyFiles(workspace: string, name: string, folder: string): Promise<FamilyFile[]> {
  const evidence = await recordFiles(folder);
  const analysis = await recordFiles(path.join(analysisFolder(workspace), name));
  return [...evidence, ...analysis];
}

const readJson = async (file: string): Promise<unknown> => JSON.parse(await readFile(file, 'utf8'));

async function sourceLines(files: readonly FamilyFile[]): Promise<ReturnType<typeof citedLines>> {
  const sources: EvidenceRecord[] = [];
  await inTurn(
    files.filter(([family]) => family === 'sources'),
    async ([, file]) => {
      for await (const record of readRecords(file)) sources.push(record);
    },
  );
  return citedLines(sources);
}

// Records are streamed twice, rows then links, so a large repository is never held whole.
async function insertRecords(
  statements: Statements,
  name: string,
  files: readonly FamilyFile[],
): Promise<{
  readonly rowids: ReadonlyMap<string, number>;
  readonly counts: ReadonlyMap<string, number>;
}> {
  const sources = await sourceLines(files);
  const rowids = new Map<string, number>();
  const counts = new Map<string, number>();
  await inTurn(files, async ([family, file]) => {
    for await (const record of readRecords(file)) {
      const row = indexedRecord(family, record, sources);
      const values = [row.kind, row.label, row.path, row.lineStart, row.lineEnd] as const;
      const inserted = statements.record.run(
        name,
        row.id,
        family,
        ...values,
        JSON.stringify(record),
      );
      const rowid = Number(inserted.lastInsertRowid);
      rowids.set(row.id, rowid);
      counts.set(family, (counts.get(family) ?? 0) + 1);
      if (!UNSEARCHED_FAMILIES.has(family)) {
        statements.search.run(rowid, row.label, row.path, row.text);
      }
    }
  });
  return { rowids, counts };
}

async function insertLinks(
  statements: Statements,
  files: readonly FamilyFile[],
  rowids: ReadonlyMap<string, number>,
): Promise<number> {
  const known = new Set(rowids.keys());
  let count = 0;
  await inTurn(files, async ([, file]) => {
    for await (const record of readRecords(file)) {
      for (const link of recordLinks(record, known)) {
        statements.link.run(rowids.get(link.from) ?? 0, link.field, rowids.get(link.to) ?? 0);
        count += 1;
      }
    }
  });
  return count;
}

async function insertRepository(
  statements: Statements,
  workspace: string,
  { name, folder }: { readonly name: string; readonly folder: string },
): Promise<{ readonly records: number; readonly links: number; readonly commit: string }> {
  const repository = fieldsOf(await readJson(path.join(folder, 'repository.json')));
  const discovery = await readJson(path.join(folder, 'discovery.json')).catch(() => null);
  const files = await familyFiles(workspace, name, folder);
  const { rowids, counts } = await insertRecords(statements, name, files);
  const links = await insertLinks(statements, files, rowids);
  const families = Object.fromEntries(
    [...counts].toSorted(([left], [right]) => left.localeCompare(right, 'en')),
  );
  const summary = { ...repository, name, records: rowids.size, families };
  statements.repository.run(
    name,
    textOf(repository.repo),
    JSON.stringify(summary),
    discovery === null ? null : JSON.stringify(discovery),
  );
  return { records: rowids.size, links, commit: textOf(repository.commit) };
}

export interface IndexBuild {
  readonly file: string;
  readonly repositories: number;
  readonly records: number;
  readonly links: number;
}

async function fill(database: DatabaseSync, workspace: string): Promise<Omit<IndexBuild, 'file'>> {
  database.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA page_size = 8192;');
  database.exec(INDEX_TABLES);
  const statements = prepared(database);
  const digest = createHash('sha256');
  const total = { repositories: 0, records: 0, links: 0 };
  database.exec('BEGIN');
  await inTurn(await evidenceRepositories(workspace), async (repository) => {
    const built = await insertRepository(statements, workspace, repository);
    digest.update(`${repository.name}@${built.commit}:${String(built.records)}\n`);
    total.repositories += 1;
    total.records += built.records;
    total.links += built.links;
  });
  database.exec(INDEX_INDEXES);
  const meta = database.prepare('INSERT INTO meta VALUES (?,?)');
  meta.run('format', INDEX_FORMAT);
  meta.run('builtAt', new Date().toISOString());
  meta.run('evidence', digest.digest('hex'));
  database.exec('COMMIT');
  database.exec("INSERT INTO search (search) VALUES ('optimize'); PRAGMA optimize;");
  return total;
}

export async function buildEvidenceIndex(workspace: string): Promise<IndexBuild> {
  const file = path.join(workspace, ...INDEX_PATH);
  const building = `${file}.building`;
  await mkdir(path.dirname(file), { recursive: true });
  await rm(building, { force: true });
  const database = new DatabaseSync(building);
  try {
    const total = await fill(database, workspace);
    database.close();
    await rename(building, file);
    return { file, ...total };
  } catch (error) {
    if (database.isOpen) database.close();
    await rm(building, { force: true });
    throw error;
  }
}
