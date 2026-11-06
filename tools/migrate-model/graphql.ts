import { parseDocument, type Sel } from '@/application/plan/federation-parse';
import { buildId, localId } from '@/domain/ids';
import { modelList, modelRecord, modelText } from '@/domain/workspace-model';

import { codeReference } from './citations';
import { fingerprint, type MigrationReview } from './review';

type Node = Readonly<Record<string, unknown>>;
export interface MigratedOperation {
  readonly operation: Node;
  readonly record: Node | null;
  readonly repo: string | null;
}
function documentBinding(
  operation: Node,
  document: string,
  source: NonNullable<ReturnType<typeof codeReference>>,
  review: MigrationReview,
): Node {
  const id = buildId('ev', `authored-graphql-${fingerprint(operation.id).slice(0, 24)}`);
  const base = {
    kind: 'graphql_document_binding',
    id,
    source,
    document,
    document_name: operation.name ?? localId(modelText(operation.id) ?? ''),
    operation_type: operation.kind,
    operation_name: operation.name ?? null,
    variables: [],
    selections: [],
  };
  const parsed = parseDocument(document);
  if (!parsed.ok || parsed.kind === null || parsed.operations !== 1) {
    review.add('graphql-documents', `document/${String(operation.id)}`, operation, {
      id: operation.id,
      document,
      reason: parsed.error ?? 'The document does not select one operation.',
      disposition: 'Full document retained; selections remain a visible gap.',
    });
    return base;
  }
  return {
    ...base,
    operation_type: parsed.kind,
    operation_name: parsed.name,
    variables: parsed.variables.map((variable) => ({
      name: variable.name,
      type: variable.type,
      source: id,
    })),
    selections: flattenedSelections(parsed.selections, id),
    limitations: [
      'Selections describe possible resolver reach. Arguments and directives remain in the full document; the migration does not interpret runtime conditions.',
    ],
  };
}
function flattenedSelections(
  selections: readonly Sel[],
  source: string,
  parents: readonly string[] = [],
): readonly Node[] {
  return selections.flatMap((selection) => {
    const path = [...parents, selection.key];
    return [
      { path: path.join('.'), field_name: selection.name, source, arguments: [] },
      ...flattenedSelections(selection.selections ?? [], source, path),
    ];
  });
}
function operationOwner(operation: Node, review: MigrationReview): string | null {
  const component = modelText(operation.component) ?? modelText(operation.client);
  if (component !== null) return component;
  const accepted = modelRecord(
    review.add('placements', `operation/${String(operation.id)}`, operation, {
      id: operation.id,
      sources: operation.sources,
      proposed: null,
      reason: 'No explicit client component is recorded.',
    }),
  );
  return modelText(accepted?.component);
}

export function migrateOperation(input: unknown, review: MigrationReview): MigratedOperation {
  const operation = modelRecord(input);
  if (operation === null) throw new Error('Expected a GraphQL operation.');
  const owner = operationOwner(operation, review);
  const document = modelText(operation.document);
  const source =
    modelList(operation.sources)
      .map(codeReference)
      .find((value) => value !== null) ?? null;
  const record =
    document === null || source === null
      ? null
      : documentBinding(operation, document, source, review);
  const fields = Object.fromEntries(
    Object.entries(operation).filter(
      ([key]) => !['client', 'component', 'document', 'sources', 'origin'].includes(key),
    ),
  );
  if (record === null) {
    review.add('documents', `document/${String(operation.id)}`, operation, {
      id: operation.id,
      reason: 'No cited source location for the authored document.',
    });
  }
  return {
    operation: {
      ...fields,
      ...(owner === null ? {} : { component: owner }),
      document: record?.id ?? operation.document,
    },
    record,
    repo: source?.repo ?? null,
  };
}
