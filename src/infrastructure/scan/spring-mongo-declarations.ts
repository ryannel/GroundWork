import 'server-only';

import { resolveJavaType, type JavaMethod } from './java-declarations';
import type {
  MongoCollectionBinding,
  MongoRepositoryBinding,
  MongoRepositoryMethod,
} from './spring-mongo-types';
import {
  springDeclaration,
  springInheritedDeclarations,
  type SpringDeclaration,
} from './spring-schema-inheritance';
import { springTypeReference } from './spring-schema-types';

const DOCUMENT = 'org.springframework.data.mongodb.core.mapping.Document';
const REPOSITORY = 'org.springframework.data.mongodb.repository.MongoRepository';

export function mongoLiteral(text: string | undefined): string | null {
  if (text === undefined || text === '' || !/^"[^"\\]*"$/u.test(text.trim())) return null;
  const literal = text.trim().slice(1, -1);
  return literal === '' ? null : literal;
}
export function mongoCollections(
  declarations: readonly SpringDeclaration[],
): MongoCollectionBinding[] {
  return declarations.flatMap(({ type }) => {
    const annotation = type.annotations.find((item) => item.name === DOCUMENT);
    if (!annotation) return [];
    const collection = mongoLiteral(annotation.arguments.collection ?? annotation.arguments.value);
    return [
      {
        kind: 'mongo_collection_binding',
        id: `mongo-collection:${type.qualifiedName}`,
        entityType: type.qualifiedName,
        collection,
        source: annotation.source,
        gaps: [
          ...(collection === null
            ? ['Collection naming or expression mapping is unresolved.']
            : []),
          'Effective BSON mapping, database address and deployed configuration are unresolved.',
        ],
      },
    ];
  });
}
export function mongoMethodOperation(name: string): MongoRepositoryMethod['operation'] {
  if (/^(?:find|read|get|query|search|stream|count|exists)(?:By|All|First|Top|One|$)/u.test(name)) {
    return 'read';
  }
  if (/^(?:save|insert|delete|remove)(?:By|All|$)/u.test(name)) return 'write';
  return 'unknown';
}
function methodBinding(method: JavaMethod): MongoRepositoryMethod {
  const preference = method.annotations.find(
    (item) => item.name === 'org.springframework.data.mongodb.repository.ReadPreference',
  );
  return {
    name: method.name,
    operation: mongoMethodOperation(method.name),
    source: method.source,
    readPreference: mongoLiteral(preference?.arguments.value),
  };
}
function repositoryParent(
  declaration: SpringDeclaration,
  declarations: readonly SpringDeclaration[],
) {
  return springInheritedDeclarations(declaration, declarations).declarations.flatMap((entry) =>
    entry.type.extends.flatMap((parent) => {
      const reference = springTypeReference(parent);
      return resolveJavaType(reference.name, entry.unit) === REPOSITORY
        ? [{ entry, reference }]
        : [];
    }),
  )[0];
}
function fragmentsOf(
  declaration: SpringDeclaration,
  declarations: readonly SpringDeclaration[],
): MongoRepositoryBinding['fragments'] {
  return declaration.type.extends.flatMap((parent) => {
    const fragment = springDeclaration(parent, declaration.unit, declarations);
    if (!fragment || repositoryParent(fragment, declarations)) return [];
    const implementation = declarations.find(
      (candidate) =>
        candidate.type.qualifiedName === `${fragment.type.qualifiedName}Impl` &&
        candidate.type.implements.some(
          (name) => resolveJavaType(name, candidate.unit) === fragment.type.qualifiedName,
        ),
    );
    return [
      {
        interfaceType: fragment.type.qualifiedName,
        implementationType: implementation?.type.qualifiedName ?? null,
        source: fragment.type.source,
      },
    ];
  });
}
export function mongoRepositories(
  declarations: readonly SpringDeclaration[],
  collections: readonly MongoCollectionBinding[],
): MongoRepositoryBinding[] {
  return declarations.flatMap((declaration) => {
    if (declaration.type.kind !== 'interface') return [];
    const parent = repositoryParent(declaration, declarations);
    if (!parent) return [];
    const entityType = resolveJavaType(
      parent.reference.arguments[0]?.name ?? '',
      parent.entry.unit,
    );
    const collection = collections.find((item) => item.entityType === entityType);
    if (!collection) return [];
    const inherited = springInheritedDeclarations(declaration, declarations).declarations;
    return [
      {
        kind: 'mongo_repository_binding',
        id: `mongo-repository:${declaration.type.qualifiedName}`,
        repositoryType: declaration.type.qualifiedName,
        entityType,
        collection_id: collection.id,
        idType: mongoIdType(parent.reference.arguments[1]?.name ?? '', parent.entry),
        fragments: fragmentsOf(declaration, declarations),
        methods: inherited.flatMap((entry) => entry.type.methods.map(methodBinding)),
        source: declaration.type.source,
      },
    ];
  });
}

function mongoIdType(name: string, declaration: SpringDeclaration): string {
  if (['String', 'Long', 'Integer', 'Object'].includes(name)) return `java.lang.${name}`;
  return resolveJavaType(name, declaration.unit);
}
