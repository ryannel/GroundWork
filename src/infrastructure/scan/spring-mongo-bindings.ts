import 'server-only';

import type { JavaUnit } from './java-declarations';
import type { SourceIndex } from './source-index-types';
import { mongoCollections, mongoRepositories } from './spring-mongo-declarations';
import { mongoOperations } from './spring-mongo-operations';
import type {
  MongoBinding,
  MongoOperationBinding,
  MongoRepositoryBinding,
  MongoRepositoryMethod,
} from './spring-mongo-types';
import type { SpringDeclaration } from './spring-schema-inheritance';

/** Declared Mongo mappings and typed storage invocations; runtime effects remain unresolved. */
export function collectMongoBindings(
  indexes: readonly SourceIndex[],
  units: readonly JavaUnit[],
): readonly MongoBinding[] {
  const declarations = units.flatMap((unit) => unit.types.map((type) => ({ unit, type })));
  const collections = mongoCollections(declarations);
  const repositories = mongoRepositories(declarations, collections);
  const operations = mongoOperations({ indexes, declarations, collections, repositories });
  const joined = repositories.map((repository) => ({
    ...repository,
    methods: repository.methods.map((method) =>
      fragmentMethod({ repository, declarations, operations }, method),
    ),
  }));
  return [...collections, ...joined, ...joinOperations(operations, joined, declarations)];
}

function joinOperations(
  operations: readonly MongoOperationBinding[],
  repositories: readonly MongoRepositoryBinding[],
  declarations: readonly SpringDeclaration[],
): MongoOperationBinding[] {
  return operations.map((operation) => {
    const repository = repositories.find((candidate) => candidate.id === operation.repository_id);
    const method = repository?.methods.find((candidate) => candidate.name === operation.method);
    if (!repository || !method) return operation;
    const evidence = fragmentEvidence({ repository, declarations, operations }, method);
    return {
      ...operation,
      operation: method.operation,
      support: [...new Set([...operation.support, ...evidence.support])],
    };
  });
}

interface FragmentContext {
  readonly repository: MongoRepositoryBinding;
  readonly declarations: readonly SpringDeclaration[];
  readonly operations: readonly MongoOperationBinding[];
}
function fragmentMethod(
  context: FragmentContext,
  method: MongoRepositoryMethod,
): MongoRepositoryMethod {
  if (method.operation !== 'unknown') return method;
  const effects = fragmentEvidence(context, method).effects;
  return effects.length === 1 ? { ...method, operation: effects[0] ?? 'unknown' } : method;
}
function fragmentEvidence(context: FragmentContext, method: MongoRepositoryMethod) {
  const implementations = context.repository.fragments.flatMap((fragment) =>
    context.declarations.filter(
      (entry) => entry.type.qualifiedName === fragment.implementationType,
    ),
  );
  const methods = implementations.flatMap((entry) =>
    entry.type.methods.filter((candidate) => candidate.name === method.name),
  );
  const calls = methods.flatMap((candidate) => candidate.calls ?? []);
  const bound = context.operations.filter((operation) =>
    calls.some((call) => call.source === operation.source),
  );
  const effects = [...new Set(bound.map((operation) => operation.operation))];
  return {
    effects,
    support: [
      ...implementations.map((entry) => entry.type.source),
      ...methods.map((candidate) => candidate.source),
      ...bound.map((operation) => operation.source),
    ],
  };
}
