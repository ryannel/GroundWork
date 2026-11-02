import { describe, expect, it, vi } from 'vitest';

import { javaDeclarations } from '@/infrastructure/scan/java-declarations';
import { indexSource } from '@/infrastructure/scan/source-index';
import { collectMongoBindings } from '@/infrastructure/scan/spring-mongo-bindings';

vi.mock(import('server-only'), () => ({}));
const NATIVE = process.env.GROUNDWORK_NATIVE_PARSERS === '1';

function fixture(collection = 'archive') {
  const index = indexSource({
    path: 'src/main/java/Storage.java',
    language: 'java',
    content: `package fixture;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.ReadPreference;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Update;
@Document("${collection}") record Entry(String id) {}
interface ArchiveFragment { void upsertEntry(Entry entry); }
interface ArchiveRepository extends MongoRepository<Entry, String>, ArchiveFragment {
 @ReadPreference("secondaryPreferred") Entry findById(String id);
}
class ArchiveFragmentImpl implements ArchiveFragment {
 MongoTemplate template;
 public void upsertEntry(Entry entry) {
  template.upsert(Query.query(Criteria.where("id").is(entry.id())),
   new Update().setOnInsert("created", 1).set("entry", entry), Entry.class);
 }
}
class Other { void save(Entry entry) {} }
class Service {
 ArchiveRepository archive; Other other;
 void run(Entry entry) { archive.save(entry); archive
 .findById("id"); archive.upsertEntry(entry); other.save(entry); }
 void shadow(Other archive, Entry entry) { archive.save(entry); }
}`,
  });
  expect(index.diagnostics).toEqual([]);
  const unit = javaDeclarations(index);
  if (!unit) throw new Error('Compiler produced no declaration unit.');
  return collectMongoBindings([index], [unit]);
}

describe.skipIf(!NATIVE)('native Mongo storage bindings', () => {
  it('binds declared collections, generic repositories, inherited operations and fragment updates', () => {
    const records = fixture();
    expect(records.find((record) => record.kind === 'mongo_collection_binding')).toMatchObject({
      entityType: 'fixture.Entry',
      collection: 'archive',
    });
    expect(records.find((record) => record.kind === 'mongo_repository_binding')).toMatchObject({
      repositoryType: 'fixture.ArchiveRepository',
      idType: 'java.lang.String',
      fragments: [
        {
          interfaceType: 'fixture.ArchiveFragment',
          implementationType: 'fixture.ArchiveFragmentImpl',
        },
      ],
      methods: expect.arrayContaining([
        expect.objectContaining({
          name: 'findById',
          operation: 'read',
          readPreference: 'secondaryPreferred',
        }),
      ]) as unknown,
    });
    const operations = records.filter((record) => record.kind === 'mongo_operation_binding');
    expect(
      operations
        .map((record) => record.method)
        .toSorted((left, right) => left.localeCompare(right)),
    ).toEqual(['findById', 'save', 'upsert', 'upsertEntry']);
    expect(operations.find((record) => record.method === 'upsertEntry')).toMatchObject({
      operation: 'write',
    });
    expect(operations.find((record) => record.method === 'upsert')).toMatchObject({
      receiverType: 'org.springframework.data.mongodb.core.MongoTemplate',
      operation: 'write',
      filter_fields: ['id'],
      update_fields: [
        { operator: '$set', field: 'entry', source: expect.any(String) as unknown },
        { operator: '$setOnInsert', field: 'created', source: expect.any(String) as unknown },
      ],
    });
  });
  it('retains changed physical collection declarations without assuming deployment identity', () => {
    expect(
      fixture('changed').find((record) => record.kind === 'mongo_collection_binding'),
    ).toMatchObject({
      collection: 'changed',
      gaps: expect.arrayContaining([expect.stringContaining('database address')]) as unknown,
    });
  });
  it('resolves generic repository inheritance and field receivers despite parameter and block shadows', () => {
    const index = indexSource({
      path: 'src/main/java/Inherited.java',
      language: 'java',
      content: `package fixture;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.repository.MongoRepository;
@Document("entries") record Entry(String id) {}
interface BaseRepository<T, ID> extends MongoRepository<T, ID> {}
interface EntryRepository extends BaseRepository<Entry, String> {}
class Other { void save(Entry entry) {} }
class Parent { EntryRepository repository; }
class Child extends Parent {
 void run(Other repository, Entry entry) { repository.save(entry); this.repository.save(entry); }
 void scoped(Entry entry) { { Other repository = new Other(); repository.save(entry); } repository.save(entry); }
}`,
    });
    const unit = javaDeclarations(index);
    const records = collectMongoBindings([index], unit ? [unit] : []);
    expect(records.filter((record) => record.kind === 'mongo_repository_binding')).toHaveLength(1);
    expect(records.filter((record) => record.kind === 'mongo_operation_binding')).toHaveLength(2);
    expect(
      records
        .filter((record) => record.kind === 'mongo_operation_binding')
        .every(
          (record) =>
            record.receiverType === 'fixture.EntryRepository' && record.operation === 'write',
        ),
    ).toBe(true);
  });
  it('rejects spoofed short annotation and MongoTemplate names', () => {
    const index = indexSource({
      path: 'src/main/java/Spoof.java',
      language: 'java',
      content: `package spoof;
@interface Document { String value(); }
@Document("fake") class Entry {}
class MongoTemplate { void upsert(Object x, Object y, Class<?> z) {} }
class Service { MongoTemplate template; void run() { template.upsert(null, null, Entry.class); } }`,
    });
    const unit = javaDeclarations(index);
    expect(collectMongoBindings([index], unit ? [unit] : [])).toEqual([]);
  });
});
