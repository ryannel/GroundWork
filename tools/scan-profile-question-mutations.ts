import type { ScanDocument, SemanticEdge, SemanticNode } from '@/domain/scan/scan.generated';

import { QUESTION_MUTATIONS } from './scan-profile-question-scenarios';
import { profileQuestionProofs } from './scan-profile-review';
import { profileGraph } from './scan-profile-review-graph';
import { descendants, targets } from './scan-semantic-query';

interface Scope {
  readonly file: string;
  readonly method?: string;
}
type Change =
  | {
      readonly kind: 'relation';
      readonly scope: Scope;
      readonly relation: SemanticEdge['relation'];
    }
  | { readonly kind: 'reference'; readonly scope: Scope }
  | {
      readonly kind: 'atom';
      readonly scope: Scope;
      readonly atom: 'value' | 'operator' | 'name';
      readonly from: string;
      readonly to: string;
    }
  | {
      readonly kind: 'order';
      readonly scope: Scope;
      readonly callee: string;
      readonly positions: readonly [number, number];
    }
  | {
      readonly kind: 'boundary';
      readonly file: string;
      readonly field: 'logical' | 'method' | 'failures' | 'response';
    }
  | { readonly kind: 'document'; readonly document: string }
  | { readonly kind: 'contract'; readonly type: string }
  | {
      readonly kind: 'contract_type';
      readonly type: string;
      readonly property: string;
      readonly value: string;
    }
  | { readonly kind: 'constant'; readonly name: string; readonly value: string };
export interface QuestionMutationScenario {
  readonly question: 'q12' | 'q13';
  readonly name: string;
  readonly change: Change;
}
interface QuestionMutationResult {
  readonly question: 'q12' | 'q13';
  readonly name: string;
  readonly baselinePassed: boolean;
  readonly mutationApplied: boolean;
  readonly rejected: boolean;
}

function scopedNodes(document: ScanDocument, scope: Scope): readonly SemanticNode[] {
  const graph = profileGraph(document);
  const sources = new Set(
    document.sources
      .filter((source) => source.path.endsWith(`/${scope.file}.java`))
      .map((source) => source.id),
  );
  const nodes = graph.nodes.filter((node) => sources.has(node.source));
  if (scope.method === undefined) return nodes;
  const methods = nodes.filter(
    (node) => node.nodeKind === 'function' && node.name === scope.method,
  );
  return methods.flatMap((method) => descendants(graph, method));
}

function semanticChange(
  input: ScanDocument,
  change: Extract<Change, { readonly scope: Scope }>,
): boolean {
  const document = input;
  const nodes = scopedNodes(document, change.scope);
  const ids = new Set(nodes.map((node) => node.id));
  const sources = new Set(nodes.map((node) => node.source));
  if (change.kind === 'reference') {
    const before = document.bindings?.length ?? 0;
    document.bindings = (document.bindings ?? []).filter(
      (binding) =>
        binding.kind !== 'java_value_binding' ||
        binding.relation !== 'reference' ||
        !sources.has(binding.to),
    );
    return document.bindings.length < before;
  }
  if (change.kind === 'relation') {
    const before = document.semantic?.length ?? 0;
    document.semantic = (document.semantic ?? []).filter(
      (record) =>
        record.kind !== 'semantic_edge' ||
        record.relation !== change.relation ||
        !ids.has(record.from),
    );
    return document.semantic.length < before;
  }
  if (change.kind === 'order') return swapArguments(document, nodes, change);
  let changed = false;
  for (const node of nodes) {
    if (node[change.atom] === change.from) {
      node[change.atom] = change.to;
      changed = true;
    }
  }
  return changed;
}

function swapArguments(
  document: ScanDocument,
  nodes: readonly SemanticNode[],
  change: Extract<Change, { readonly kind: 'order' }>,
): boolean {
  const graph = profileGraph(document);
  const calls = new Set(
    nodes
      .filter(
        (node) =>
          ['call', 'construct'].includes(node.nodeKind) &&
          targets(graph, node, 'callee')[0]?.name === change.callee,
      )
      .map((node) => node.id),
  );
  const [first, second] = change.positions;
  let changed = false;
  for (const edge of document.semantic ?? []) {
    if (edge.kind !== 'semantic_edge' || edge.relation !== 'argument' || !calls.has(edge.from)) {
      continue;
    }
    if (edge.position === first) {
      edge.position = second;
      changed = true;
    } else if (edge.position === second) {
      edge.position = first;
      changed = true;
    }
  }
  return changed;
}

function boundaryChange(
  document: ScanDocument,
  change: Extract<Change, { readonly kind: 'boundary' }>,
): boolean {
  const sources = new Set(
    document.sources
      .filter((source) => source.path.endsWith(`/${change.file}.java`))
      .map((source) => source.id),
  );
  const boundaries = (document.bindings ?? []).filter(
    (binding) => binding.kind === 'outbound_binding' || binding.kind === 'graphql_binding',
  );
  let changed = false;
  for (const binding of boundaries) {
    if (!sources.has(binding.source)) continue;
    if (change.field === 'logical') binding.client.logical_name = 'unrelated-client';
    if (change.field === 'failures') binding.failure_paths = [];
    if (change.field === 'response') binding.response.type = 'unrelated.Response';
    if (change.field === 'method' && binding.kind === 'outbound_binding') {
      binding.request.method = 'POST';
    }
    changed = true;
  }
  return changed;
}

function contractChange(document: ScanDocument, type: string): boolean {
  let changed = false;
  for (const binding of document.framework ?? []) {
    if (binding.kind === 'schema_binding' && binding.typeName.endsWith(`.${type}`)) {
      changed = binding.properties.length > 0 || changed;
      binding.properties = [];
    }
  }
  return changed;
}

function constantChange(
  document: ScanDocument,
  change: Extract<Change, { readonly kind: 'constant' }>,
): boolean {
  const constants = (document.bindings ?? [])
    .filter((binding) => binding.kind === 'java_constant_binding')
    .filter((binding) => binding.name === change.name);
  for (const binding of constants) binding.value = change.value;
  return constants.length > 0;
}

function contractTypeChange(
  document: ScanDocument,
  change: Extract<Change, { readonly kind: 'contract_type' }>,
): boolean {
  let changed = false;
  for (const binding of document.framework ?? []) {
    if (binding.kind !== 'schema_binding' || binding.typeName !== change.type) continue;
    for (const property of binding.properties) {
      if (property.name !== change.property || property.type === change.value) continue;
      property.type = change.value;
      changed = true;
    }
  }
  return changed;
}

function documentChange(document: ScanDocument, name: string): boolean {
  let changed = false;
  for (const binding of document.bindings ?? []) {
    if (binding.kind !== 'graphql_document_binding' || binding.document_name !== name) {
      continue;
    }
    for (const selection of binding.selections) {
      for (const argument of selection.arguments) {
        argument.variable = 'unrelated-variable';
        changed = true;
      }
    }
  }
  return changed;
}

function applyChange(document: ScanDocument, change: Change): boolean {
  switch (change.kind) {
    case 'relation':
    case 'reference':
    case 'atom':
    case 'order': {
      return semanticChange(document, change);
    }
    case 'boundary': {
      return boundaryChange(document, change);
    }
    case 'contract': {
      return contractChange(document, change.type);
    }
    case 'contract_type': {
      return contractTypeChange(document, change);
    }
    case 'constant': {
      return constantChange(document, change);
    }
    case 'document': {
      return documentChange(document, change.document);
    }
  }
}

/** Rejection requires an entire supported question, an applied mutation and loss of that same question. */
export function profileQuestionMutations(
  document: ScanDocument,
): readonly QuestionMutationResult[] {
  const baseline = profileQuestionProofs(document);
  return QUESTION_MUTATIONS.map((scenario) => {
    const changed = structuredClone(document);
    const mutationApplied = applyChange(changed, scenario.change);
    const baselinePassed = baseline[scenario.question].supported;
    const rejected =
      baselinePassed &&
      mutationApplied &&
      !profileQuestionProofs(changed)[scenario.question].supported;
    return {
      question: scenario.question,
      name: scenario.name,
      baselinePassed,
      mutationApplied,
      rejected,
    };
  });
}
