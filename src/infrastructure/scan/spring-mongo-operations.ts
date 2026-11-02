import 'server-only';

import { declarationParameter, declarationSource, declarationText } from './java-declaration-parts';
import { resolveJavaType, type JavaMethod, type JavaParameter } from './java-declarations';
import type { SourceIndex, SyntaxNode } from './source-index-types';
import { mongoLiteral, mongoMethodOperation } from './spring-mongo-declarations';
import type {
  MongoCollectionBinding,
  MongoOperationBinding,
  MongoRepositoryBinding,
} from './spring-mongo-types';
import { springInheritedDeclarations, type SpringDeclaration } from './spring-schema-inheritance';
import { enclosingFunction } from './syntax-candidates';

export interface MongoOperationContext {
  readonly indexes: readonly SourceIndex[];
  readonly declarations: readonly SpringDeclaration[];
  readonly collections: readonly MongoCollectionBinding[];
  readonly repositories: readonly MongoRepositoryBinding[];
}
const TEMPLATE = 'org.springframework.data.mongodb.core.MongoTemplate';

function receiver(
  context: {
    readonly index: SourceIndex;
    readonly declaration: SpringDeclaration;
    readonly method: JavaMethod;
    readonly node: SyntaxNode;
  },
  declarations: readonly SpringDeclaration[],
): JavaParameter | undefined {
  const callee = declarationText(context.index, context.node, 'callee')[0] ?? '';
  const name = callee
    .slice(0, callee.lastIndexOf('.'))
    .trim()
    .replace(/^this\./u, '');
  if (name.includes('.')) return undefined;
  if (callee.startsWith('this.')) return receiverField(context.declaration, declarations, name);
  const owner = enclosingFunction(context.index, context.node);
  const locals = context.index.nodes.filter(
    (node) =>
      node.kind === 'VARIABLE' &&
      node.symbol === name &&
      node.end < context.node.start &&
      enclosingFunction(context.index, node) === owner,
  );
  const local = locals.findLast((node) => visibleLocal(context.index, node, context.node));
  return local
    ? declarationParameter(context.index, local)
    : (context.method.parameters.find((parameter) => parameter.name === name) ??
        receiverField(context.declaration, declarations, name));
}
function receiverField(
  declaration: SpringDeclaration,
  declarations: readonly SpringDeclaration[],
  name: string,
): JavaParameter | undefined {
  return springInheritedDeclarations(declaration, declarations)
    .declarations.flatMap((entry) =>
      entry.type.fields.map((field) => ({
        ...field,
        type: resolveJavaType(field.type, entry.unit),
      })),
    )
    .find((field) => field.name === name);
}
function visibleLocal(index: SourceIndex, declaration: SyntaxNode, call: SyntaxNode): boolean {
  let position = declaration.parent;
  while (position !== null) {
    const parent = index.nodes[position];
    if (!parent) return false;
    if (['BLOCK', 'FOR_LOOP', 'ENHANCED_FOR_LOOP', 'CATCH'].includes(parent.kind)) {
      return parent.start <= call.start && parent.end >= call.end;
    }
    position = parent.parent;
  }
  return false;
}
function updateFields(
  index: SourceIndex,
  node: SyntaxNode,
  declaration: SpringDeclaration,
): MongoOperationBinding['update_fields'] {
  const span = node.fields?.arguments?.[1];
  if (!span) return [];
  return index.nodes
    .filter(
      (entry) =>
        entry.kind === 'METHOD_INVOCATION' && entry.start >= span[0] && entry.end <= span[1],
    )
    .flatMap((entry) => {
      const callee = declarationText(index, entry, 'callee')[0] ?? '';
      const method = callee.slice(callee.lastIndexOf('.') + 1).trim();
      const field = mongoLiteral(declarationText(index, entry, 'arguments')[0]);
      const constructed = /^new\s+([\w.]+)\s*\(/u.exec(callee)?.[1];
      if (field === null || !['set', 'setOnInsert'].includes(method)) return [];
      if (
        constructed === undefined ||
        resolveJavaType(constructed, declaration.unit) !==
          'org.springframework.data.mongodb.core.query.Update'
      ) {
        return [];
      }
      return [
        {
          operator: method === 'set' ? ('$set' as const) : ('$setOnInsert' as const),
          field,
          source: declarationSource(index, entry),
        },
      ];
    });
}
function filterFields(
  index: SourceIndex,
  node: SyntaxNode,
  declaration: SpringDeclaration,
): string[] {
  const span = node.fields?.arguments?.[0];
  const argument = declarationText(index, node, 'arguments')[0] ?? '';
  const queryType = /^([\w.]+)\.query\s*\(/u.exec(argument)?.[1];
  if (!span || queryType === undefined) return [];
  if (
    resolveJavaType(queryType, declaration.unit) !==
    'org.springframework.data.mongodb.core.query.Query'
  ) {
    return [];
  }
  return index.nodes
    .filter(
      (entry) =>
        entry.kind === 'METHOD_INVOCATION' && entry.start >= span[0] && entry.end <= span[1],
    )
    .flatMap((entry) => {
      const callee = declarationText(index, entry, 'callee')[0] ?? '';
      const type = callee.slice(0, callee.lastIndexOf('.'));
      if (
        !callee.endsWith('.where') ||
        resolveJavaType(type, declaration.unit) !==
          'org.springframework.data.mongodb.core.query.Criteria'
      ) {
        return [];
      }
      const field = mongoLiteral(declarationText(index, entry, 'arguments')[0]);
      return field === null ? [] : [field];
    });
}
function templateCollection(
  context: MongoOperationContext,
  declaration: SpringDeclaration,
  arguments_: readonly string[],
) {
  return arguments_.flatMap((argument, position) => {
    if (!argument.endsWith('.class')) return [];
    const entity = resolveJavaType(argument, declaration.unit);
    const override = arguments_[position + 1];
    const collectionName = templateCollectionName(override, declaration);
    return context.collections.filter(
      (collection) =>
        collection.entityType === entity &&
        (override === undefined || collection.collection === collectionName),
    );
  })[0];
}
function templateCollectionName(
  expression: string | undefined,
  declaration: SpringDeclaration,
): string | null {
  if (expression === undefined) return null;
  const literal = mongoLiteral(expression);
  if (literal !== null) return literal;
  const field = declaration.type.fields.find(
    (candidate) =>
      candidate.name === expression &&
      candidate.modifiers.includes('static') &&
      candidate.modifiers.includes('final'),
  );
  return mongoLiteral(field?.initializer ?? undefined);
}
interface InvocationContext {
  readonly declaration: SpringDeclaration;
  readonly method: JavaMethod;
  readonly index: SourceIndex;
  readonly node: SyntaxNode;
}
function operation(
  context: MongoOperationContext,
  invocation: InvocationContext,
): MongoOperationBinding[] {
  const { declaration, method, index, node } = invocation;
  const bound = receiver({ index, declaration, method, node }, context.declarations);
  if (!bound) return [];
  const receiverType = resolveJavaType(bound.type, declaration.unit);
  const repository = context.repositories.find((item) => item.repositoryType === receiverType);
  const callee = declarationText(index, node, 'callee')[0] ?? '';
  const name = callee.slice(callee.lastIndexOf('.') + 1).trim();
  const collection = operationCollection(context, invocation, { repository, receiverType });
  if (!collection) return [];
  const template = receiverType === TEMPLATE;
  const declared = repository?.methods.find((item) => item.name === name);
  const support = [bound.source, collection.source, ...repositorySupport(repository, name)];
  const source = declarationSource(index, node);
  return [
    {
      kind: 'mongo_operation_binding',
      id: `mongo-operation:${source}`,
      receiverType,
      receiver_source: bound.source,
      method: name,
      operation: template
        ? templateOperation(name)
        : (declared?.operation ?? mongoMethodOperation(name)),
      collection_id: collection.id,
      repository_id: repository?.id ?? null,
      entityType: collection.entityType,
      filter_fields: template ? filterFields(index, node, declaration) : [],
      update_fields: template ? templateUpdateFields(index, node, declaration) : [],
      source,
      support,
      gaps: [
        'Source invocation does not establish durable acknowledgement, transaction scope or deployed database identity.',
      ],
    },
  ];
}
function repositorySupport(repository: MongoRepositoryBinding | undefined, name: string): string[] {
  if (!repository) return [];
  const method = repository.methods.find((entry) => entry.name === name);
  return [repository.source, ...(method ? [method.source] : [])];
}
function operationCollection(
  context: MongoOperationContext,
  invocation: InvocationContext,
  binding: {
    readonly repository: MongoRepositoryBinding | undefined;
    readonly receiverType: string;
  },
) {
  if (binding.repository) {
    return context.collections.find((item) => item.id === binding.repository?.collection_id);
  }
  if (binding.receiverType !== TEMPLATE) return null;
  return templateCollection(
    context,
    invocation.declaration,
    declarationText(invocation.index, invocation.node, 'arguments'),
  );
}
function templateOperation(name: string): MongoOperationBinding['operation'] {
  if (
    [
      'upsert',
      'updateFirst',
      'updateMulti',
      'save',
      'insert',
      'insertAll',
      'remove',
      'findAndModify',
      'findAndRemove',
    ].includes(name)
  ) {
    return 'write';
  }
  return ['find', 'findOne', 'findById', 'findAll', 'exists', 'count', 'stream'].includes(name)
    ? 'read'
    : 'unknown';
}
function templateUpdateFields(
  index: SourceIndex,
  node: SyntaxNode,
  declaration: SpringDeclaration,
) {
  const argument = declarationText(index, node, 'arguments')[1] ?? '';
  const construction = /^new\s+([\w.]+)\s*\(/u.exec(argument)?.[1];
  return construction !== undefined &&
    resolveJavaType(construction, declaration.unit) ===
      'org.springframework.data.mongodb.core.query.Update'
    ? updateFields(index, node, declaration)
    : [];
}
export function mongoOperations(context: MongoOperationContext): MongoOperationBinding[] {
  return context.declarations.flatMap((declaration) => {
    const index = context.indexes.find((candidate) => candidate.path === declaration.unit.path);
    if (!index) return [];
    return declaration.type.methods.flatMap((method) => {
      const methodNode = index.nodes.find(
        (node) => declarationSource(index, node) === method.source,
      );
      if (!methodNode) return [];
      const owner = index.nodes.indexOf(methodNode);
      return index.nodes
        .filter(
          (node) => node.kind === 'METHOD_INVOCATION' && enclosingFunction(index, node) === owner,
        )
        .flatMap((node) => operation(context, { declaration, method, index, node }));
    });
  });
}
