import type {
  ScanDocument,
  SemanticEdge,
  SemanticNode,
  SemanticRecord,
} from '@/domain/scan/scan.generated';

interface NodeChange {
  readonly matches: (node: SemanticNode) => boolean;
  readonly patch: Partial<Pick<SemanticNode, 'name' | 'value' | 'operator' | 'declaredAsync'>>;
}
const CHANGES: Readonly<Record<string, NodeChange>> = {
  'spring-async-activation': {
    matches: (node) => node.nodeKind === 'function' && node.name === 'postProcess',
    patch: { declaredAsync: false },
  },
  'spring-disabled-publication': {
    matches: (node) => node.nodeKind === 'binary' && node.operator === '||',
    patch: { operator: '&&' },
  },
  'go-error-not-throw': {
    matches: (node) => node.nodeKind === 'unary' && node.operator === '!',
    patch: { operator: '^' },
  },
  'go-staged-versus-committed': {
    matches: (node) => node.nodeKind === 'member' && node.name === 'Commit',
    patch: { name: 'Rollback' },
  },
  'ts-address-response-and-availability': {
    matches: (node) => node.nodeKind === 'binary' && node.operator === '!==',
    patch: { operator: '===' },
  },
  'ts-income-response-to-onNext': {
    matches: (node) => node.nodeKind === 'member' && node.name === 'adjustedIncome',
    patch: { name: 'changedIncome' },
  },
  'ts-server-lineage-and-hops': {
    matches: (node) => node.nodeKind === 'literal' && node.value === 4,
    patch: { value: 5 },
  },
  'ts-server-failure-and-output': {
    matches: (node) => node.nodeKind === 'literal' && node.value === 500,
    patch: { value: 200 },
  },
};
const REMOVALS: Readonly<Partial<Record<string, SemanticEdge['relation']>>> = {
  'spring-equal-branch': 'consequent',
  'spring-rebound-save-result': 'reaching_value',
  'spring-returned-completion': 'continuation',
  'spring-archive-failure-window': 'catch',
  'go-contextual-registry': 'registry_context_unknown',
  'go-insert-before-commit': 'deferred',
  'go-enqueue-not-delivery': 'delivery_unknown',
  'go-sql-positional-bindings': 'column_binding',
  'ts-address-callback-and-wire': 'binds',
  'ts-income-callback-not-awaiting': 'awaited',
};

function reverseStatements(records: readonly SemanticRecord[]): SemanticRecord[] {
  const fn = records.find(
    (record) =>
      record.kind === 'semantic_node' &&
      record.nodeKind === 'function' &&
      record.name === 'moveCustomerToArchivedCollection',
  );
  const maximum = new Map<string, number>();
  for (const record of records) {
    if (record.kind === 'semantic_edge' && record.relation === 'statement') {
      maximum.set(record.from, Math.max(maximum.get(record.from) ?? 0, record.position ?? 0));
    }
  }
  return records.map((record) => {
    if (record.kind !== 'semantic_edge' || record.owner !== fn?.owner) return record;
    if (record.relation !== 'statement' || record.position === undefined) return record;
    return { ...record, position: (maximum.get(record.from) ?? 0) - record.position };
  });
}

function changedRecords(records: readonly SemanticRecord[], check: string): SemanticRecord[] {
  const relation = REMOVALS[check];
  if (relation !== undefined) {
    return records.filter(
      (record) => record.kind !== 'semantic_edge' || record.relation !== relation,
    );
  }
  if (check === 'spring-archive-order') return reverseStatements(records);
  const change = CHANGES[check];
  return records.map((record) =>
    record.kind === 'semantic_node' && change?.matches(record) === true
      ? { ...record, ...change.patch }
      : record,
  );
}

/** Native relations/atoms change while their original source spellings deliberately remain unchanged. */
export function depthMutation(
  input: ScanDocument,
  check: string,
): { readonly document: ScanDocument; readonly changed: boolean } {
  const document = structuredClone(input);
  const records = document.semantic ?? [];
  const semantic = changedRecords(records, check);
  return {
    document: { ...document, semantic },
    changed: JSON.stringify(records) !== JSON.stringify(semantic),
  };
}
