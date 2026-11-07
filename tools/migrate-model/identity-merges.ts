import path from 'node:path';

import { buildId, localId, parseId } from '@/domain/ids';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import { migrationCitations } from './citations';
import { migrateContracts } from './contracts';
import { rewriteDocument, type MigrationFile } from './files';
import { fingerprint, migrationReview, type MigrationReview, type ReviewRow } from './review';

type Node = Readonly<Record<string, unknown>>;
export interface ReviewedIdentityMerge {
  readonly aliases: ReadonlyMap<string, string>;
  readonly external: Node;
  readonly contract: Node;
  readonly contractFile: string;
  readonly componentCount: number;
  readonly interfaceCount: number;
}
function node(value: unknown): Node {
  const result = modelRecord(value);
  if (result === null) throw new Error('Identity merge requires an object.');
  return result;
}
function records(value: unknown): readonly Node[] {
  return modelList(value).map(node);
}
function id(value: Node): string {
  const result = modelText(value.id);
  if (result === null) throw new Error('Identity merge requires an id.');
  return result;
}
function provider(value: Node): unknown {
  return value.service ?? value.component ?? value.external ?? value.system;
}
function equal(actual: unknown, expected: unknown, label: string): void {
  if (fingerprint(actual) !== fingerprint(expected)) {
    throw new Error(`Identity merge mismatch: ${label}`);
  }
}
/** Match the complete current source set, retaining the explicitly reviewed source order. */
function currentSources(actual: readonly Node[], expected: readonly Node[]): readonly Node[] {
  equal(
    actual.map(fingerprint).toSorted((a, b) => a.localeCompare(b)),
    expected.map(fingerprint).toSorted((a, b) => a.localeCompare(b)),
    'source records',
  );
  return expected.map((value) => {
    const found = actual.find((candidate) => fingerprint(candidate) === fingerprint(value));
    if (found === undefined) throw new Error('Identity merge source disappeared.');
    return found;
  });
}
function mergeSources(
  files: readonly MigrationFile[],
  row: ReviewRow,
): {
  readonly components: readonly Node[];
  readonly interfaces: readonly Node[];
} {
  const source = node(row.source_records);
  const declared = records(source.components);
  const providers = new Set(declared.map(id));
  const components = files.flatMap((file) =>
    /\/(?:system|contracts)\.yaml$/u.test(file.path)
      ? records(node(file.value).components).filter((value) => providers.has(id(value)))
      : [],
  );
  const interfaces = files.flatMap((file) =>
    file.path.endsWith('/contracts.yaml')
      ? records(node(file.value).interfaces).filter((value) =>
          providers.has(String(provider(value))),
        )
      : [],
  );
  return {
    components: currentSources(components, declared),
    interfaces: currentSources(interfaces, records(source.interfaces)),
  };
}
function aliasesFor(
  components: readonly Node[],
  interfaces: readonly Node[],
  external: Node,
  contract: Node,
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  const add = (before: string, after: string): void => {
    const previous = result.get(before);
    if (previous !== undefined && previous !== after) {
      throw new Error(`Conflicting merge alias: ${before}`);
    }
    if (before !== after) result.set(before, after);
  };
  const roots = components.filter((value) => value.type === 'external');
  if (roots.length < 2 || roots.some((value) => modelList(value.talks_to).length > 0)) {
    throw new Error(
      'Identity merge requires separate external declarations without outgoing facts.',
    );
  }
  const candidates = roots.map((value) => buildId('ext', localId(id(value))));
  if (!candidates.includes(id(external)) || (parseId(external.id)?.path.length ?? 1) > 0) {
    throw new Error('Identity merge must retain an existing external identity.');
  }
  for (const component of components) add(id(component), id(external));
  for (const candidate of candidates) add(candidate, id(external));
  interfaceAliases(interfaces, external, contract, add);
  return result;
}
function interfaceAliases(
  interfaces: readonly Node[],
  external: Node,
  contract: Node,
  add: (before: string, after: string) => void,
): void {
  const retained = interfaces.find((value) => value.id === contract.id);
  if (retained === undefined || interfaces.length < 2 || contract.external !== external.id) {
    throw new Error('Identity merge must retain a source interface and its provider.');
  }
  const entries = records(retained.endpoints ?? retained.entries);
  const canonicalEntries = records(contract.entries);
  equal(entries.map(id), canonicalEntries.map(id), 'retained entry identities');
  for (const value of interfaces) {
    add(id(value), id(contract));
    const endpoints = records(value.endpoints ?? value.entries);
    if (endpoints.length !== entries.length) throw new Error('Identity merge entry count differs.');
    for (const [index, entry] of endpoints.entries()) add(id(entry), id(entries[index] ?? {}));
  }
}
function canonicalExternal(
  components: readonly Node[],
  external: Node,
  review: MigrationReview,
): Node {
  const citations = migrationCitations([], review, 'identity-merge');
  const names = components.flatMap((value) => modelText(value.name) ?? []);
  if (!names.includes(String(external.name))) {
    throw new Error('Identity merge must retain a source name.');
  }
  const texts = ['name', 'does', 'tech', 'summary'].flatMap((field) =>
    components.flatMap((value) => modelText(value[field]) ?? []),
  );
  const cites = [...new Set(components.flatMap((value) => citations.convert(value)))];
  const result = {
    id: external.id,
    name: external.name,
    summary: [...new Set(texts)].join('\n\n'),
    ...(cites.length === 0 ? {} : { cites }),
  };
  equal(external, result, 'canonical external texts and citations');
  return result;
}
function reviewedMerge(
  files: readonly MigrationFile[],
  review: MigrationReview,
  row: ReviewRow,
): ReviewedIdentityMerge {
  const source = mergeSources(files, row);
  review.add('identity-merges', row.key, source, { source_records: source });
  const external = node(row.canonical_external);
  const contract = node(row.canonical_interface);
  const aliases = aliasesFor(source.components, source.interfaces, external, contract);
  equal(Object.fromEntries(aliases), row.aliases, 'complete alias map');
  const validation = migrationReview();
  const citations = migrationCitations([], validation, 'identity-merge');
  for (const value of source.interfaces) {
    const migrated = migrateContracts(rewriteDocument({ interfaces: [value] }, aliases), {
      review: validation,
      citations,
    });
    equal(records(migrated.interfaces)[0], contract, 'canonical interface and every entry');
  }
  const homes = files.filter(
    (file) =>
      file.path.endsWith('/contracts.yaml') &&
      records(node(file.value).interfaces).some((value) => value.id === contract.id),
  );
  if (homes.length !== 1) throw new Error('Identity merge canonical interface home is ambiguous.');
  const implemented = files.some(
    (file) =>
      file.path.endsWith('/handlers.yaml') &&
      records(node(file.value).handlers).some((value) => aliases.has(String(value.component))),
  );
  if (implemented) throw new Error('Identity merge cannot retire an implemented component.');
  return {
    aliases,
    external: canonicalExternal(source.components, external, validation),
    contract,
    contractFile: path.posix.join(path.posix.dirname(homes[0]?.path ?? ''), 'contracts.yaml'),
    componentCount: source.components.filter((value) => value.type === 'external').length,
    interfaceCount: source.interfaces.length,
  };
}
export function reviewedIdentityMerges(
  files: readonly MigrationFile[],
  review: MigrationReview,
): readonly ReviewedIdentityMerge[] {
  const result = review.decisions('merge/').map((row) => reviewedMerge(files, review, row));
  const seen = new Set<string>();
  for (const merge of result) {
    for (const key of [id(merge.external), id(merge.contract), ...merge.aliases.keys()]) {
      if (seen.has(key)) throw new Error(`Overlapping identity merge: ${key}`);
      seen.add(key);
    }
  }
  return result;
}
function assertExternalTexts(value: Node, summary: string): void {
  const texts = [value.name, ...(modelText(value.summary) ?? '').split('\n\n')];
  if (texts.some((text) => typeof text === 'string' && !summary.includes(text))) {
    throw new Error('Identity merge would lose external text.');
  }
}
/** Only proved duplicates are replaced; the ordinary declaration conflict guard remains strict. */
export function mergeExternals(
  values: readonly Node[],
  merges: readonly ReviewedIdentityMerge[],
): readonly Node[] {
  let result = values;
  for (const merge of merges) {
    const selected = result.filter((value) => value.id === merge.external.id);
    if (selected.length !== merge.componentCount) {
      throw new Error('Identity merge external count changed.');
    }
    for (const value of selected) {
      assertExternalTexts(value, modelText(merge.external.summary) ?? '');
    }
    equal(
      [...new Set(selected.flatMap((value) => modelList(value.cites)))]
        .map(fingerprint)
        .toSorted((a, b) => a.localeCompare(b)),
      modelList(merge.external.cites)
        .map(fingerprint)
        .toSorted((a, b) => a.localeCompare(b)),
      'external citation union',
    );
    result = [...result.filter((value) => value.id !== merge.external.id), merge.external];
  }
  return result;
}
interface Fragment {
  readonly family: string | null;
  readonly definition?: string;
  readonly value: unknown;
}
function mergedInterfaces(
  file: string,
  value: Node,
  merge: ReviewedIdentityMerge,
): { readonly value: Node; readonly count: number } {
  const interfaces = records(value.interfaces);
  const selected = interfaces.filter((contract) => contract.id === merge.contract.id);
  for (const contract of selected) equal(contract, merge.contract, 'generated canonical interface');
  return {
    count: selected.length,
    value: {
      ...value,
      interfaces: [
        ...interfaces.filter((contract) => contract.id !== merge.contract.id),
        ...(file === merge.contractFile ? [merge.contract] : []),
      ],
    },
  };
}
export function mergeInterfaceFiles(
  files: ReadonlyMap<string, Fragment>,
  merges: readonly ReviewedIdentityMerge[],
): ReadonlyMap<string, Node> {
  const contracts = new Map(
    [...files].flatMap(([file, fragment]) =>
      fragment.family === 'workspace' && fragment.definition === 'ContractsFile'
        ? [[file, node(fragment.value)] as const]
        : [],
    ),
  );
  for (const merge of merges) {
    let count = 0;
    for (const [file, value] of contracts) {
      const merged = mergedInterfaces(file, value, merge);
      count += merged.count;
      contracts.set(file, merged.value);
    }
    if (count !== merge.interfaceCount || !contracts.has(merge.contractFile)) {
      throw new Error('Identity merge interface count or home changed.');
    }
  }
  return contracts;
}
