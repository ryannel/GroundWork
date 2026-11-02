import { describe, expect, it } from 'vitest';

import { scanFixture } from '@/../test/scan-kit';

import { validateScanDocument } from './check-scan';
import type {
  ExceptionBinding,
  JavaCallBinding,
  JavaValueBinding,
  MongoCollectionBinding,
  MongoOperationBinding,
  MongoRepositoryBinding,
  OutboundBinding,
} from './scan.generated';

function fixture() {
  const document = scanFixture();
  const template = document.sources[0]!;
  const sources = [
    ['caller', 'Caller.java', 1, 40],
    ['call', 'Caller.java', 8, 8],
    ['receiver', 'Caller.java', 8, 8],
    ['guard', 'Caller.java', 5, 15],
    ['argument', 'Caller.java', 8, 8],
    ['target', 'Target.java', 1, 20],
    ['formal', 'Target.java', 1, 2],
    ['return', 'Target.java', 10, 10],
    ['collection', 'Entity.java', 1, 3],
    ['repository', 'Repository.java', 1, 10],
    ['repository-method', 'Repository.java', 3, 4],
    ['field', 'Caller.java', 1, 2],
    ['mongo-call', 'Caller.java', 18, 23],
    ['update', 'Caller.java', 20, 21],
    ['throw', 'Caller.java', 25, 25],
    ['throw-guard', 'Caller.java', 24, 24],
    ['constructor', 'Caller.java', 25, 25],
    ['try', 'Caller.java', 22, 28],
    ['advice', 'Advice.java', 1, 15],
    ['handler', 'Advice.java', 3, 12],
    ['handler-return', 'Advice.java', 10, 10],
  ] as const;
  document.sources.push(
    ...sources.map(([id, path, from, to]) => ({
      ...template,
      id,
      path,
      lines: [from, to] as [number, number],
    })),
  );
  const call: JavaCallBinding = {
    kind: 'java_call_binding',
    id: 'call-binding',
    call: 'call',
    caller: 'caller',
    receiver: 'receiver',
    receiverType: 'fixture.Target',
    methodName: 'apply',
    argumentTypes: ['String'],
    target: 'target',
    signature: 'fixture.Target#apply(String):String',
    resolution: 'exact',
    reason: 'Unique indexed declaration.',
    guards: ['guard'],
  };
  const value: JavaValueBinding = {
    kind: 'java_value_binding',
    id: 'value-binding',
    relation: 'argument_parameter',
    from: 'argument',
    to: 'formal',
    call: 'call',
    guards: ['guard'],
  };
  const collection: MongoCollectionBinding = {
    kind: 'mongo_collection_binding',
    id: 'collection-binding',
    entityType: 'fixture.Entity',
    collection: 'entities',
    source: 'collection',
    gaps: [],
  };
  const repository: MongoRepositoryBinding = {
    kind: 'mongo_repository_binding',
    id: 'repository-binding',
    repositoryType: 'fixture.Repository',
    entityType: 'fixture.Entity',
    collection_id: collection.id,
    idType: 'String',
    fragments: [
      { interfaceType: 'fixture.Fragment', implementationType: null, source: 'repository' },
    ],
    methods: [
      { name: 'save', operation: 'write', source: 'repository-method', readPreference: null },
    ],
    source: 'repository',
  };
  const operation: MongoOperationBinding = {
    kind: 'mongo_operation_binding',
    id: 'mongo-binding',
    receiverType: 'fixture.Repository',
    receiver_source: 'field',
    method: 'save',
    operation: 'write',
    collection_id: collection.id,
    repository_id: repository.id,
    entityType: 'fixture.Entity',
    filter_fields: [],
    update_fields: [{ operator: '$set', field: 'name', source: 'update' }],
    source: 'mongo-call',
    support: ['field', 'collection', 'repository'],
    gaps: [],
  };
  const exception: ExceptionBinding = {
    kind: 'exception_binding',
    id: 'exception-binding',
    source_ids: ['throw', 'caller'],
    thrown_type: 'fixture.Missing',
    throw_source_id: 'throw',
    throwing_method_source_id: 'caller',
    constructor_argument_source_ids: ['constructor'],
    guard_source_ids: ['throw-guard'],
    enclosing_try_source_ids: ['try'],
    local_controller_handler_source_ids: [],
    candidates: [
      {
        advice: 'fixture.Advice',
        advice_source_id: 'advice',
        handler_source_id: 'handler',
        handled_type: 'fixture.Missing',
        scope: 'global',
        response_return_source_ids: ['handler-return'],
        response_construction_source_ids: ['handler-return'],
        response_construction_owners: [
          { source_id: 'handler-return', owner_method_source_id: 'handler' },
        ],
        support_source_ids: ['advice'],
      },
    ],
    resolution: 'unresolved',
    uncertainties: ['Enclosing try requires analysis.'],
  };
  document.bindings = [call, value, collection, repository, operation, exception];
  return { document, call, value, collection, repository, operation, exception };
}

describe('native binding reference and ownership invariants', () => {
  it('accepts pinned native bindings and value relations across indexed files', () => {
    const { document } = fixture();
    document.bindings?.push({
      kind: 'java_value_binding',
      id: 'return-binding',
      relation: 'return_call',
      from: 'return',
      to: 'call',
      call: 'call',
      guards: [],
    });
    expect(validateScanDocument(document)).toEqual([]);
  });
  it('rejects duplicate IDs, wrong binding kinds and missing nested evidence', () => {
    const { document, repository, operation, exception } = fixture();
    document.bindings?.push({ ...operation });
    operation.collection_id = repository.id;
    repository.fragments[0]!.source = 'host:server';
    exception.candidates[0]!.response_construction_source_ids = ['missing-construction'];
    const errors = validateScanDocument(document);
    expect(errors).toContain('mongo-binding: duplicate record id');
    expect(errors).toContain(
      'mongo-binding: repository-binding must reference mongo_collection_binding',
    );
    expect(errors).toContain('repository-binding: host:server must reference source');
    expect(errors).toContain('exception-binding: missing-construction must reference source');
  });
  it('rejects source pin changes and collection references across repositories', () => {
    const { document, collection, operation } = fixture();
    document.sources.push({ ...document.sources[0]!, id: 'foreign', repo: 'other/repo' });
    operation.update_fields[0]!.source = 'foreign';
    collection.source = 'foreign';
    const errors = validateScanDocument(document);
    expect(errors).toContain('mongo-binding: binding source foreign crosses repository or commit');
    expect(errors).toContain(
      'mongo-binding: binding reference collection-binding crosses repository or commit',
    );
    expect(errors).toContain(
      'repository-binding: binding reference collection-binding crosses repository or commit',
    );
  });
  it('rejects caller, receiver, guard, actual argument and formal parameter ownership changes', () => {
    const { document, call, value } = fixture();
    call.caller = 'target';
    call.receiver = 'return';
    call.guards = ['target'];
    value.from = 'return';
    value.to = 'caller';
    const errors = validateScanDocument(document);
    expect(errors).toContain('call-binding: source call must be within target');
    expect(errors).toContain('call-binding: source return must be within call');
    expect(errors).toContain('value-binding: source return must be within call');
    expect(errors).toContain('value-binding: source caller must be within target');
  });
  it('requires an exact matching call and validates returned values against that target', () => {
    const { document, call, value } = fixture();
    value.relation = 'return_call';
    value.from = 'argument';
    value.to = 'formal';
    value.guards = [];
    expect(validateScanDocument(document)).toContain(
      'value-binding: source argument must be within target',
    );
    expect(validateScanDocument(document)).toContain(
      'value-binding: returned value must target its call source',
    );
    call.resolution = 'unresolved';
    call.target = null;
    call.signature = null;
    expect(validateScanDocument(document)).toContain(
      'value-binding: interprocedural value requires an exact call binding',
    );
  });
  it('permits helper construction with its own typed caller and preserves direct handler return ownership', () => {
    const { document, call, exception } = fixture();
    const candidate = exception.candidates[0]!;
    candidate.response_construction_source_ids = ['return'];
    candidate.response_construction_owners = [
      { source_id: 'return', owner_method_source_id: 'target' },
    ];
    document.bindings?.push({
      ...call,
      id: 'helper-construction-call',
      call: 'return',
      caller: 'target',
      receiver: null,
      target: null,
      signature: null,
      resolution: 'unresolved',
      guards: [],
    });
    expect(validateScanDocument(document)).toEqual([]);
    candidate.response_construction_owners[0]!.owner_method_source_id = 'advice';
    expect(validateScanDocument(document)).toContain(
      'exception-binding: source return must be within advice',
    );
    candidate.response_construction_owners[0]!.owner_method_source_id = 'target';
    document.bindings =
      document.bindings?.filter((binding) => binding.id !== 'helper-construction-call') ?? [];
    expect(validateScanDocument(document)).toContain(
      'exception-binding: helper construction source return requires its indexed caller binding',
    );
  });
  it('validates outbound nested sources, typed links, source pins and method ownership', () => {
    const { document } = fixture();
    const outbound: OutboundBinding = {
      kind: 'outbound_binding',
      id: 'outbound-binding',
      source: 'mongo-call',
      owner_source: 'caller',
      client: {
        type: 'org.springframework.web.client.RestClient',
        receiver_source: 'field',
        logical_name: null,
        registry_source: null,
      },
      request: {
        method: 'GET',
        method_source: 'call',
        uri_source: 'call',
        template: '/things/{id}',
        argument_sources: ['argument'],
        headers: [{ name: 'x-token', source: 'mongo-call', value_sources: ['update'] }],
        accept_sources: [],
        body_sources: [],
      },
      response: {
        type: 'fixture.Result',
        type_source: 'argument',
        body_source: 'mongo-call',
        return_sources: ['throw'],
      },
      failure_paths: [
        {
          caught_type: 'fixture.External',
          source: 'try',
          thrown_type: 'fixture.Missing',
          thrown_source: 'throw',
        },
      ],
      call_binding_ids: ['call-binding'],
      value_binding_ids: ['value-binding'],
      support: ['caller'],
      completeness: 'partial',
      gaps: ['External configuration unobserved.'],
    };
    document.bindings?.push(outbound);
    expect(validateScanDocument(document)).toEqual([]);
    outbound.call_binding_ids = ['value-binding'];
    outbound.value_binding_ids = ['repository-binding'];
    outbound.request.headers[0]!.value_sources = ['missing-header'];
    outbound.failure_paths[0]!.thrown_source = 'return';
    outbound.owner_source = 'target';
    const errors = validateScanDocument(document);
    expect(errors).toContain('outbound-binding: value-binding must reference java_call_binding');
    expect(errors).toContain(
      'outbound-binding: repository-binding must reference java_value_binding',
    );
    expect(errors).toContain('outbound-binding: missing-header must reference source');
    expect(errors).toContain('outbound-binding: source return must be within try');
    expect(errors).toContain('outbound-binding: source mongo-call must be within target');
  });
  it('accepts guarded record projections across source files and rejects detached projection targets', () => {
    const { document, value, call } = fixture();
    value.relation = 'field_projection';
    value.from = 'collection';
    value.to = 'call';
    call.resolution = 'unresolved';
    call.target = null;
    call.signature = null;
    expect(validateScanDocument(document)).toEqual([]);
    value.to = 'formal';
    expect(validateScanDocument(document)).toContain(
      'value-binding: field projection must target its indexed call source',
    );
  });
  it('rejects mixed null resolution, Mongo receiver identity and exception ownership changes', () => {
    const { document, call, operation, exception } = fixture();
    call.target = null;
    operation.receiverType = 'fixture.Other';
    exception.guard_source_ids = ['return'];
    exception.constructor_argument_source_ids = ['formal'];
    exception.candidates[0]!.handler_source_id = 'caller';
    const errors = validateScanDocument(document);
    expect(errors).toContain('call-binding: call resolution must agree with target and signature');
    expect(errors).toContain(
      'mongo-binding: repository receiver and collection must match operation',
    );
    expect(errors).toContain('exception-binding: source return must be within caller');
    expect(errors).toContain('exception-binding: source formal must be within throw');
    expect(errors).toContain('exception-binding: source caller must be within advice');
  });
});
