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
  readonly path: string;
  readonly key: string;
  readonly name: string;
  readonly alias: string | null;
  readonly field: string | null;
  readonly parentType: string | null;
  /** The graph-type it returns; null for scalars. */
  readonly type: string | null;
  readonly typeStr: string | null;
  readonly list: boolean;
  /** This field or an ancestor is a list. */
  readonly underList: boolean;
  readonly nonNull: boolean;
  readonly parent: TreeNode | null;
  readonly children: readonly TreeNode[];
  /** Set on nodes the gateway adds itself. */
  readonly $router?: 'requires';
}

export type TreeErrorCode =
  'unknown-operation' | 'parse' | 'no-root' | 'unknown-field' | 'top-level' | 'no-selection';

export interface TreeError {
  readonly code: TreeErrorCode;
  readonly message: string;
  readonly path?: string;
}

export interface SelectionTree {
  readonly operation: OperationNode | null;
  readonly parsed: ParsedDocument;
  readonly root: SchemaNode | null;
  readonly nodes: readonly TreeNode[];
  readonly all: readonly TreeNode[];
  readonly errors: readonly TreeError[];
}

interface Build {
  readonly idx: GraphIndex;
  readonly root: SchemaNode;
}

const fieldFacts = (fd: FieldNode | null): Pick<TreeNode, 'field' | 'typeStr'> => ({
  field: fd?.id ?? null,
  typeStr: fd?.type ?? null,
});

/** A node whose children are read through `children`, so they can point back at it as their parent. */
function makeNode(
  b: Build,
  sel: Sel,
  at: {
    readonly parent: TreeNode | null;
    readonly type: SchemaNode;
    readonly children: () => readonly TreeNode[];
  },
): TreeNode {
  const { parent, type, children } = at;
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
    get children() {
      return children();
    },
  };
}

type Built = Pick<SelectionTree, 'nodes' | 'all' | 'errors'>;

/** The nodes under the root, every node in the order it was built, and the fields that do not resolve. */
function buildTree(b: Build, selections: readonly Sel[]): Built {
  const all: TreeNode[] = [];
  const errors: TreeError[] = [];
  const buildNode = (
    sel: Sel,
    at: { readonly parent: TreeNode | null; readonly type: SchemaNode },
  ): TreeNode => {
    const { parent, type } = at;
    let children: readonly TreeNode[] = [];
    const node = makeNode(b, sel, { ...at, children: () => children });
    all.push(node);
    if (sel.name === '__typename') return node;
    if (node.field === null) {
      errors.push({
        code: parent === null ? 'top-level' : 'unknown-field',
        path: node.path,
        message: `${node.path}: ${parent === null ? b.root.name : type.name} has no field ${sel.name}`,
      });
      return node;
    }
    const target =
      node.type === null ? undefined : b.idx.types.get(parseTypeRef(node.typeStr).name);
    if (target === undefined) return node;
    const kids = sel.selections ?? [];
    if (kids.length === 0) {
      errors.push({
        code: 'no-selection',
        path: node.path,
        message: `${node.path} returns ${target.name}, so it needs a selection { … }`,
      });
    } else children = kids.map((c) => buildNode(c, { parent: node, type: target }));
    return node;
  };
  const nodes = selections.map((s) => buildNode(s, { parent: null, type: b.root }));
  return { nodes, all, errors };
}

const trees = memoPerGraph<SelectionTree>();

function treeOf(g: SystemGraph, opId: string): SelectionTree {
  const op = operationNode(g, opId);
  const out: SelectionTree = {
    operation: op ?? null,
    parsed: parseDocument(op?.document),
    root: null,
    nodes: [],
    all: [],
    errors: [],
  };
  if (op === undefined) {
    return {
      ...out,
      errors: [{ code: 'unknown-operation', message: `${opId} is not an operation` }],
    };
  }
  const { parsed } = out;
  const errors: readonly TreeError[] =
    parsed.kind === null || parsed.error !== null
      ? [
          {
            code: 'parse',
            message: `${op.name}: the document does not parse (${parsed.error ?? ''})`,
          },
        ]
      : [];
  const kind = parsed.kind === 'subscription' ? null : parsed.kind;
  if (kind === null) return { ...out, errors };
  const idx = graphIndex(g, op.graph);
  const root = idx.roots[kind];
  if (root === null) {
    const message = `${op.graph} has no ${kind === 'query' ? 'Query' : 'Mutation'} type (a kind: graph-type schema with root: ${kind})`;
    return { ...out, errors: [...errors, { code: 'no-root', message }] };
  }
  const built = buildTree({ idx, root }, parsed.selections);
  return { ...out, root, ...built, errors: [...errors, ...built.errors] };
}

/** The operation's document resolved against its graph's types. Never throws. */
export function selectionTree(g: SystemGraph, opId: string): SelectionTree {
  return trees(g, opId, () => treeOf(g, opId));
}
