import {
  fieldNamed,
  graphIndex,
  memoPerGraph,
  operationNode,
  type GraphIndex,
} from '@/application/plan/federation-index';
import {
  parseDocument,
  parseTypeRef,
  type ParsedDocument,
  type Sel,
} from '@/application/plan/federation-parse';
import type { FieldNode, OperationNode, SchemaNode, SystemGraph } from '@/domain/plan/plan-graph';

/** One selected field, resolved against its graph's types. */
export interface TreeNode {
  /** `product.price.amount`, by response key. */
  path: string;
  key: string;
  name: string;
  alias: string | null;
  field: string | null;
  parentType: string | null;
  /** The graph-type it returns; null for scalars. */
  type: string | null;
  typeStr: string | null;
  list: boolean;
  /** This field or an ancestor is a list. */
  underList: boolean;
  nonNull: boolean;
  parent: TreeNode | null;
  children: TreeNode[];
  /** Set on nodes the gateway adds itself. */
  $router?: 'requires';
}

export type TreeErrorCode =
  'unknown-operation' | 'parse' | 'no-root' | 'unknown-field' | 'top-level' | 'no-selection';

export interface TreeError {
  code: TreeErrorCode;
  message: string;
  path?: string;
}

export interface SelectionTree {
  operation: OperationNode | null;
  parsed: ParsedDocument;
  root: SchemaNode | null;
  nodes: TreeNode[];
  all: TreeNode[];
  errors: TreeError[];
}

interface Build {
  idx: GraphIndex;
  root: SchemaNode;
  all: TreeNode[];
  errors: TreeError[];
}

const fieldFacts = (fd: FieldNode | null): Pick<TreeNode, 'field' | 'typeStr'> => ({
  field: fd?.id ?? null,
  typeStr: fd?.type ?? null,
});

function makeNode(b: Build, sel: Sel, at: { parent: TreeNode | null; type: SchemaNode }): TreeNode {
  const { parent, type } = at;
  const fd = fieldNamed(type, sel.name);
  const ref = parseTypeRef(fd?.type);
  const target = b.idx.types.get(fd === null ? '' : ref.name) ?? null;
  return {
    path: parent === null ? sel.key : `${parent.path}.${sel.key}`,
    key: sel.key,
    name: sel.name,
    alias: sel.alias,
    ...fieldFacts(fd),
    parentType: type.id,
    type: target?.id ?? null,
    list: ref.list,
    underList: ref.list || parent?.underList === true,
    nonNull: ref.nonNull,
    parent,
    children: [],
  };
}

function buildNode(
  b: Build,
  sel: Sel,
  at: { parent: TreeNode | null; type: SchemaNode },
): TreeNode {
  const { parent, type } = at;
  const node = makeNode(b, sel, at);
  b.all.push(node);
  if (sel.name === '__typename') return node;
  if (node.field === null) {
    b.errors.push({
      code: parent === null ? 'top-level' : 'unknown-field',
      path: node.path,
      message: `${node.path}: ${parent === null ? b.root.name : type.name} has no field ${sel.name}`,
    });
    return node;
  }
  const target = node.type === null ? undefined : b.idx.types.get(parseTypeRef(node.typeStr).name);
  if (target === undefined) return node;
  const kids = sel.selections ?? [];
  if (kids.length === 0) {
    b.errors.push({
      code: 'no-selection',
      path: node.path,
      message: `${node.path} returns ${target.name}, so it needs a selection { … }`,
    });
  } else node.children = kids.map((c) => buildNode(b, c, { parent: node, type: target }));
  return node;
}

const trees = memoPerGraph<SelectionTree>();

function treeOf(g: SystemGraph, opId: string): SelectionTree {
  const op = operationNode(g, opId);
  const errors: TreeError[] = [];
  const out: SelectionTree = {
    operation: op ?? null,
    parsed: parseDocument(op?.document),
    root: null,
    nodes: [],
    all: [],
    errors,
  };
  if (op === undefined) {
    errors.push({ code: 'unknown-operation', message: `${opId} is not an operation` });
    return out;
  }
  const { parsed } = out;
  if (parsed.kind === null || parsed.error !== null) {
    errors.push({
      code: 'parse',
      message: `${op.name}: the document does not parse (${parsed.error ?? ''})`,
    });
  }
  const kind = parsed.kind === 'subscription' ? null : parsed.kind;
  if (kind === null) return out;
  const idx = graphIndex(g, op.graph);
  const root = idx.roots[kind];
  if (root === null) {
    errors.push({
      code: 'no-root',
      message: `${op.graph} has no ${kind === 'query' ? 'Query' : 'Mutation'} type (a kind: graph-type schema with root: ${kind})`,
    });
    return out;
  }
  out.root = root;
  const build: Build = { idx, root, all: out.all, errors };
  out.nodes = parsed.selections.map((s) => buildNode(build, s, { parent: null, type: root }));
  return out;
}

/** The operation's document resolved against its graph's types. Never throws. */
export function selectionTree(g: SystemGraph, opId: string): SelectionTree {
  return trees(g, opId, () => treeOf(g, opId));
}
