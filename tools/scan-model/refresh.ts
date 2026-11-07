import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { isMap, parseDocument, type Document } from 'yaml';

import { parseAuthoredCodeCitation } from '@/domain/code-links';
import { failureId, nestedId } from '@/domain/ids';
import { modelList, modelRecord, modelText, type AuthoredModel } from '@/domain/workspace-model';
import { modelValidator } from '@/infrastructure/model-schema';

import { applyContractFill, applyHandlerObservation, type acceptedScan } from './accepted';
import type { routeContracts } from './contracts';

type Alias = AuthoredModel<'Alias'>;
type Position = readonly (string | number)[];

interface RefreshOptions {
  readonly additions: ReadonlyMap<string, readonly string[]>;
  readonly accepted: Awaited<ReturnType<typeof acceptedScan>>;
  readonly observedContracts: ReturnType<typeof routeContracts>;
  readonly sourceSpans: ReadonlyMap<string, string>;
  readonly evidenceIds: ReadonlySet<string>;
  readonly schemaIds: ReadonlySet<string>;
  readonly aliases: Readonly<Record<string, Alias | undefined>>;
}

interface FileRefresh {
  readonly file: string;
  readonly text: string;
  readonly refreshed: number;
  readonly seen: readonly string[];
  readonly ambiguities: readonly string[];
  readonly retired: Readonly<Record<string, Alias>>;
}

interface RecordAt {
  readonly id: string;
  readonly at: Position;
  readonly data: Readonly<Record<string, unknown>>;
}

function recordsAt(value: unknown, parent: Position): readonly RecordAt[] {
  return modelList(value).flatMap((node, index) => {
    const data = modelRecord(node);
    const id = modelText(data?.id);
    return data === null || id === null ? [] : [{ id, at: [...parent, index], data }];
  });
}

function handlerSteps(
  owner: RecordAt,
  handler: string,
  ancestors: readonly string[] = [],
): readonly RecordAt[] {
  const ordinary = ['steps', 'then', 'else', 'try', 'catch', 'finally'].flatMap((field) =>
    recordsAt(owner.data[field], [...owner.at, field]),
  );
  const lanes = modelList(owner.data.parallel).flatMap((lane, index) =>
    recordsAt(modelRecord(lane)?.steps, [...owner.at, 'parallel', index, 'steps']),
  );
  const exhausted = recordsAt(modelRecord(owner.data.retry)?.exhausted, [
    ...owner.at,
    'retry',
    'exhausted',
  ]);
  return [...ordinary, ...lanes, ...exhausted].flatMap((step) => {
    const child = [...ancestors, step.id];
    return [{ ...step, id: nestedId(handler, child) }, ...handlerSteps(step, handler, child)];
  });
}

function handlerRecords(handlers: readonly RecordAt[]): readonly RecordAt[] {
  return handlers.flatMap((handler) => [
    handler,
    ...handlerSteps(handler, handler.id),
    ...recordsAt(handler.data.failures, [...handler.at, 'failures']).map((failure) => ({
      ...failure,
      id: failureId(handler.id, failure.id),
    })),
  ]);
}

function contractRecords(value: unknown): readonly RecordAt[] {
  return Object.entries(modelRecord(value) ?? {}).flatMap(([key, list]) =>
    recordsAt(list, [key]).flatMap((node) => [
      node,
      ...recordsAt(node.data.entries, [...node.at, 'entries']),
    ]),
  );
}

function hasInheritedCitation(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasInheritedCitation);
  const record = modelRecord(value);
  if (record === null) return false;
  const cites = modelList(record.cites);
  return (
    cites.some(
      (cite) => typeof cite === 'string' && parseAuthoredCodeCitation(cite)?.kind === 'inherited',
    ) || Object.values(record).some(hasInheritedCitation)
  );
}

function appendCitations(
  document: Document,
  record: RecordAt,
  citations: readonly string[],
): boolean {
  const existing = modelList(record.data.cites);
  const additions = [...new Set(citations)].filter((cite) => !existing.includes(cite));
  if (additions.length === 0) return false;
  const destination = [...record.at, 'cites'];
  if (document.hasIn(destination)) {
    for (const cite of additions) document.addIn(destination, cite);
  } else {
    const list = document.createNode(additions);
    list.flow = true;
    document.setIn(destination, list);
  }
  return true;
}

function contractProposal(record: RecordAt, options: RefreshOptions) {
  const accepted = options.accepted.contracts.get(record.id);
  if (accepted !== undefined) {
    return {
      values: applyContractFill(
        record.id,
        record.data,
        accepted,
        options.evidenceIds,
        options.schemaIds,
      ),
      cites: accepted.cites,
      reviewed: true,
    };
  }
  const observed = options.observedContracts.get(record.id);
  return { values: observed?.values ?? {}, cites: observed?.cites ?? [], reviewed: false };
}

function refreshContracts(
  document: Document,
  records: readonly RecordAt[],
  options: RefreshOptions,
) {
  const seen: string[] = [];
  let refreshed = 0;
  for (const record of records) {
    const proposal = contractProposal(record, options);
    if (proposal.reviewed) seen.push(record.id);
    const fields = Object.entries(proposal.values);
    for (const [field, fieldValue] of fields) {
      document.setIn([...record.at, field], fieldValue);
    }
    const additions = options.additions.get(record.id) ?? [];
    const cited = appendCitations(document, record, [...additions, ...proposal.cites]);
    if (cited || fields.length > 0) refreshed += 1;
  }
  return { refreshed, seen, ambiguities: [], retired: {} };
}

function refreshHandlerCites(
  document: Document,
  handlers: readonly RecordAt[],
  options: RefreshOptions,
): number {
  let refreshed = 0;
  const inherited = new Set(
    handlers.filter(({ data }) => hasInheritedCitation(data)).map(({ id }) => id),
  );
  for (const record of handlerRecords(handlers)) {
    if (inherited.has(record.id)) continue;
    if (appendCitations(document, record, options.additions.get(record.id) ?? [])) refreshed += 1;
  }
  return refreshed;
}

async function refreshHandlers(
  document: Document,
  handlers: readonly RecordAt[],
  options: RefreshOptions,
) {
  const seen: string[] = [];
  const ambiguities: string[] = [];
  const retired: Record<string, Alias> = {};
  let refreshed = 0;
  refreshed += refreshHandlerCites(document, handlers, options);
  for (const record of handlers) {
    const accepted = options.accepted.handlers.get(record.id);
    if (accepted === undefined) continue;
    seen.push(record.id);
    const updated = document.getIn(record.at, true);
    if (!isMap(updated)) throw new Error(`${record.id}: handler is not a YAML mapping.`);
    const result = await applyHandlerObservation(
      record.data,
      updated.toJSON(),
      accepted,
      options.sourceSpans,
      options.aliases,
    );
    ambiguities.push(...result.ambiguities);
    if (result.ambiguities.length === 0 && !result.alreadyApplied) {
      document.setIn(record.at, result.handler);
      Object.assign(retired, result.retired);
      refreshed += 1;
    }
  }
  return { refreshed, seen, ambiguities, retired };
}

async function refreshFile(
  folder: string,
  file: string,
  options: RefreshOptions,
): Promise<FileRefresh | null> {
  const document = parseDocument(await readFile(path.join(folder, file), 'utf8'));
  const [problem] = document.errors;
  if (problem !== undefined) throw problem;
  const value: unknown = document.toJS();
  const isHandlerFile = file.includes('/handlers/');
  const result = isHandlerFile
    ? await refreshHandlers(document, recordsAt(value, []), options)
    : refreshContracts(document, contractRecords(value), options);
  if (result.refreshed === 0 && result.seen.length === 0) return null;
  if (result.refreshed > 0) {
    const check = await modelValidator(
      'workspace',
      isHandlerFile ? 'HandlersFile' : 'ContractsFile',
    );
    if (!check(document.toJS())) {
      throw new Error(`${file}: invalid scan output: ${JSON.stringify(check.errors)}`);
    }
  }
  return { file, text: document.toString({ lineWidth: 0 }), ...result };
}

export async function refreshedFiles(
  folder: string,
  options: RefreshOptions,
): Promise<readonly FileRefresh[]> {
  const entries = await readdir(path.join(folder, 'domains'), {
    recursive: true,
    withFileTypes: true,
  });
  const paths = entries
    .flatMap((entry) => {
      if (!entry.isFile()) return [];
      const file = path.relative(folder, path.join(entry.parentPath, entry.name));
      return /\/systems\/[^/]+\/(?:contracts\.yaml|handlers\/[^/]+\.yaml)$/u.test(file)
        ? [file]
        : [];
    })
    .toSorted((left, right) => left.localeCompare(right, 'en'));
  const files = await Promise.all(paths.map(async (file) => refreshFile(folder, file, options)));
  return files.filter((file): file is FileRefresh => file !== null);
}
