import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { Document, isMap, isSeq, parse, stringify } from 'yaml';

import { isQualifiedId, rewriteIdReferences } from '@/domain/ids';
import { modelRecord } from '@/domain/workspace-model';

import { reviewSummary, type ReviewRow } from './review';

export interface MigrationFile {
  readonly path: string;
  readonly value: unknown;
  readonly text: string;
}
export async function authoredFiles(folder: string): Promise<readonly MigrationFile[]> {
  const roots = await readdir(folder, { withFileTypes: true });
  const chunks = await Promise.all(
    roots.map(async (entry) => {
      if (entry.isFile()) return [entry.name];
      if (!['domains', 'flows', 'journeys', 'programmes', 'plans'].includes(entry.name)) {
        return [];
      }
      const children = await readdir(path.join(folder, entry.name), { recursive: true });
      return children.map((name) => `${entry.name}/${name}`);
    }),
  );
  const names = chunks.flat();
  const selected = names.filter((name) =>
    /^(?:workspace\.yaml|(?:landscape|language|aliases|externals|libraries)\.yaml|(?:domains|flows|journeys|programmes|plans)\/.*\.(?:ya?ml|json))$/u.test(
      name,
    ),
  );
  return Promise.all(
    selected
      .toSorted((a, b) => a.localeCompare(b))
      .map(async (name) => {
        const text = await readFile(path.join(folder, name), 'utf8');
        const value: unknown = name.endsWith('.json') ? JSON.parse(text) : parse(text);
        return { path: name, text, value };
      }),
  );
}
export function rewriteDocument(
  value: unknown,
  replacements: ReadonlyMap<string, string>,
  rewriteKeys = true,
  field = '',
): unknown {
  if (['default', 'literal', 'document'].includes(field)) return value;
  if (typeof value === 'string') {
    return rewriteIdReferences(
      value,
      replacements,
      [
        'id',
        'on',
        'component',
        'into',
        'after',
        'modify',
        'from',
        'to',
        'relatedSystems',
        'domain',
        'domains',
        'system',
        'systems',
        'area',
        'areas',
        'plan',
        'programme',
        'builds_on',
        'actor',
        'source',
        'record_id',
        'source_ids',
        'evidence',
        'cites',
        'support',
        'file',
        'host',
      ].includes(field),
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteDocument(item, replacements, rewriteKeys, field));
  }
  const node = modelRecord(value);
  if (node === null) return value;
  return Object.fromEntries(
    Object.entries(node).map(([key, item]) => [
      rewriteKeys && (isQualifiedId(key) || ['bases', 'aliases'].includes(field))
        ? rewriteIdReferences(key, replacements)
        : key,
      rewriteDocument(item, replacements, rewriteKeys, key),
    ]),
  );
}
function compactCites(node: unknown): void {
  if (isSeq(node)) {
    for (const value of node.items) compactCites(value);
  }
  if (!isMap(node)) return;
  for (const pair of node.items) {
    if (pair.key?.toString() === 'cites' && isSeq(pair.value)) pair.value.flow = true;
    compactCites(pair.value);
  }
}
export function modelYaml(value: unknown): string {
  const document = new Document(value, { aliasDuplicateObjects: false });
  compactCites(document.contents);
  return document.toString({ lineWidth: 0 });
}
export async function writeMigrationFile(
  root: string,
  file: string,
  value: unknown,
): Promise<void> {
  const target = path.join(root, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(
    target,
    file.endsWith('.json') ? `${JSON.stringify(value, null, 2)}\n` : modelYaml(value),
  );
}
export async function writeReviews(
  folder: string,
  rows: Readonly<Record<string, readonly ReviewRow[]>>,
): Promise<void> {
  await mkdir(folder, { recursive: true });
  await writeFile(
    path.join(folder, 'summary.json'),
    `${JSON.stringify(reviewSummary(rows), null, 2)}\n`,
  );
  for (const family of ['step-ids', 'headlines', 'review-edges', ...Object.keys(rows)]) {
    await writeFile(
      path.join(folder, `${family}.yaml`),
      stringify(rows[family] ?? [], { lineWidth: 120 }),
    );
  }
}
