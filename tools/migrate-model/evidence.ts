import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { EVIDENCE_FAMILIES, type EvidenceFamily } from '@/domain/evidence/evidence';
import { buildId, hasPrefix } from '@/domain/ids';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';

import { rewriteDocument } from './files';
import { fingerprint, type MigrationReview } from './review';
import { slug } from './steps';

type Node = Readonly<Record<string, unknown>>;
interface EvidenceFile {
  readonly family: EvidenceFamily;
  readonly name: string;
  readonly records: readonly unknown[];
}
function missing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}
async function recordsIn(folder: string, family: EvidenceFamily): Promise<EvidenceFile | null> {
  const name = `${family}.jsonl`;
  try {
    const text = await readFile(path.join(folder, name), 'utf8');
    return {
      family,
      name,
      records: text
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line): unknown => JSON.parse(line)),
    };
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}
async function repositoryFiles(root: string): Promise<readonly string[]> {
  try {
    const files = await readdir(root, { recursive: true });
    return files
      .filter((file) => file.endsWith('repository.json'))
      .toSorted((a, b) => a.localeCompare(b));
  } catch (error) {
    if (missing(error)) return [];
    throw error;
  }
}
export function migratedEvidenceId(repo: string, id: string): string {
  return hasPrefix(id, 'ev') ? id : buildId('ev', `${slug(repo)}-${fingerprint(id).slice(0, 24)}`);
}

export function normaliseEvidence(
  value: unknown,
  ids: ReadonlyMap<string, string>,
  files: ReadonlyMap<string, Node>,
): unknown {
  return canonicalEvidence(rewriteDocument(value, ids, false), files);
}

function identityMap(repo: string, records: readonly unknown[]): ReadonlyMap<string, string> {
  const replacements = new Map<string, string>();
  for (const record of records) {
    const id = modelText(modelRecord(record)?.id);
    if (id === null) continue;
    if (replacements.has(id)) throw new Error(`${repo}: duplicate evidence id ${id}`);
    replacements.set(id, migratedEvidenceId(repo, id));
  }
  return replacements;
}
function canonicalEvidence(value: unknown, files: ReadonlyMap<string, Node>): unknown {
  if (Array.isArray(value)) return value.map((item) => canonicalEvidence(item, files));
  const node = modelRecord(value);
  if (node === null) return value;
  const renamed = Object.fromEntries(
    Object.entries(node).map(([key, item]) => [
      key === 'support' ? 'cites' : key,
      canonicalEvidence(item, files),
    ]),
  );
  if (renamed.kind !== 'source' || typeof renamed.path !== 'string') return renamed;
  const file = files.get(renamed.path);
  if (file === undefined || file.blob !== renamed.blob) return renamed;
  return {
    ...Object.fromEntries(
      Object.entries(renamed).filter(([key]) => !['path', 'blob'].includes(key)),
    ),
    file: file.id,
  };
}
function timestamp(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const utc = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) UTC$/u.exec(value);
  if (utc?.[1] === undefined || utc[2] === undefined) return value;
  return `${utc[1]}T${utc[2]}Z`;
}
function filesByPath(
  entries: readonly EvidenceFile[],
  replacements: ReadonlyMap<string, string>,
): ReadonlyMap<string, Node> {
  return new Map(
    entries
      .filter((entry) => entry.family === 'files')
      .flatMap((entry) => entry.records)
      .flatMap((record) => {
        const node = modelRecord(rewriteDocument(record, replacements, false));
        return typeof node?.path === 'string' ? [[node.path, node] as const] : [];
      }),
  );
}
async function convertFamily(
  entry: EvidenceFile,
  repo: string,
  replacements: ReadonlyMap<string, string>,
  files: ReadonlyMap<string, Node>,
  review: MigrationReview,
): Promise<{ readonly records: readonly unknown[]; readonly gaps: readonly Node[] }> {
  const check = await modelValidator('evidence', entry.family);
  const records: unknown[] = [];
  const gaps: Node[] = [];
  for (const original of entry.records) {
    const converted = normaliseEvidence(original, replacements, files);
    if (check(converted)) {
      records.push(converted);
      continue;
    }
    const id = modelText(modelRecord(converted)?.id) ?? fingerprint(original);
    review.add('evidence', `evidence/${repo}/${id}`, original, {
      repo,
      family: entry.family,
      original,
      converted,
      errors: structuredClone(check.errors),
      disposition:
        'Original record retained in review; a visible gap replaces unsupported normalisation.',
    });
    gaps.push({
      kind: 'gap',
      id: buildId('ev', `migration-gap-${fingerprint([repo, id]).slice(0, 24)}`),
      source: id,
      reason: 'unsupported',
      description: `Legacy ${entry.family} record ${id} needs review; the complete original is preserved in the migration evidence review file.`,
    });
  }
  return { records, gaps };
}
async function migrateDiscovery(
  source: string,
  target: string,
  replacements: ReadonlyMap<string, string>,
): Promise<void> {
  let original: unknown;
  try {
    original = JSON.parse(await readFile(path.join(source, 'discovery.json'), 'utf8'));
  } catch (error) {
    if (missing(error)) return;
    throw error;
  }
  const renamed: Readonly<Record<string, string>> = {
    readiness: 'discovery_readiness',
    coverage: 'investigation_coverage',
    sourceDeclaredComponents: 'source_declared_components',
    actionHosts: 'action_hosts',
    knowledgeGaps: 'knowledge_gaps',
    unresolvedCandidates: 'unresolved_candidates',
  };
  const node = modelRecord(rewriteDocument(original, replacements, false));
  if (node === null) throw new Error('Expected discovery metadata object.');
  const value = {
    kind: 'discovery',
    ...Object.fromEntries(Object.entries(node).map(([key, item]) => [renamed[key] ?? key, item])),
  };
  const check = await modelValidator('evidence', 'EvidenceDiscovery');
  if (!check(value)) {
    throw new Error(`Unsupported discovery metadata: ${JSON.stringify(check.errors)}`);
  }
  await writeFile(path.join(target, 'discovery.json'), `${JSON.stringify(value, null, 2)}\n`);
}
async function migrateRepository(
  root: string,
  file: string,
  out: string,
  review: MigrationReview,
): Promise<ReadonlyMap<string, string>> {
  const folder = path.dirname(file);
  const text = await readFile(path.join(root, file), 'utf8');
  const repository = modelRecord(JSON.parse(text));
  const repo = modelText(repository?.repo);
  if (repository === null || repo === null) {
    throw new Error(`${file}: missing repository identity.`);
  }
  const read = await Promise.all(
    EVIDENCE_FAMILIES.map(async (family) => recordsIn(path.join(root, folder), family)),
  );
  const entries = read.filter((value) => value !== null);
  const replacements = identityMap(
    repo,
    entries.flatMap((entry) => entry.records),
  );
  const files = filesByPath(entries, replacements);
  const target = path.join(out, 'evidence', folder);
  await mkdir(target, { recursive: true });
  const metadata = {
    ...repository,
    format: 'groundwork-evidence/v2',
    scannedAt: timestamp(repository.scannedAt),
  };
  const check = await modelValidator('evidence', 'EvidenceRepository');
  if (!check(metadata)) throw new Error(`${file}: ${JSON.stringify(check.errors)}`);
  await writeFile(path.join(target, 'repository.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  await migrateDiscovery(path.join(root, folder), target, replacements);
  const gaps: Node[] = [];
  for (const entry of entries) {
    const converted = await convertFamily(entry, repo, replacements, files, review);
    gaps.push(...converted.gaps);
    await writeFile(
      path.join(target, entry.name),
      converted.records.map((record) => JSON.stringify(record)).join('\n') +
        (converted.records.length === 0 ? '' : '\n'),
    );
  }
  if (gaps.length > 0) {
    const existing = modelList(entries.find((entry) => entry.family === 'gaps')?.records).map(
      (record) => canonicalEvidence(rewriteDocument(record, replacements, false), files),
    );
    const gapCheck = await modelValidator('evidence', 'gaps');
    for (const gap of gaps) {
      if (!gapCheck(gap)) {
        throw new Error(`Invalid migration gap: ${JSON.stringify(gapCheck.errors)}`);
      }
    }
    await writeFile(
      path.join(target, 'gaps.jsonl'),
      `${[...existing, ...gaps].map((record) => JSON.stringify(record)).join('\n')}\n`,
    );
  }
  return replacements;
}
export async function migrateEvidence(
  source: string,
  out: string,
  review: MigrationReview,
): Promise<ReadonlyMap<string, string>> {
  const root = path.join(source, 'evidence');
  const repositories = await repositoryFiles(root);
  const globalIds = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const file of repositories) {
    const replacements = await migrateRepository(root, file, out, review);
    for (const [id, next] of replacements) {
      if (globalIds.has(id) && globalIds.get(id) !== next) ambiguous.add(id);
      else globalIds.set(id, next);
    }
  }
  for (const id of ambiguous) globalIds.delete(id);
  return globalIds;
}
