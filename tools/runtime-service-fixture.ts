import type { KnowledgeBundle, KnowledgeRecord } from '@/domain/knowledge/knowledge.generated';

// Synthetic acceptance data; these records are never part of a Volvo proof.
const EVIDENCE = ['s2/e/controller'];
const ENDPOINT = '/test-downstream';
const COMPONENT = 'test/component';
const ENTRY = 'test/entry';
const CONTRACT = 'test/contract';
const RESOURCE = 'test/resource';
const RECORDS: readonly unknown[] = [
  {
    id: COMPONENT,
    kind: 'runtime_component',
    logicalId: 'test:downstream',
    label: 'Synthetic downstream',
    category: 'service',
    technology: 'HTTP',
    sources: ['s2/p'],
    basis: 'source_declared',
    gaps: [],
    evidence: EVIDENCE,
  },
  {
    id: 'test/runs',
    kind: 'execution_binding',
    implementation: 's2/http',
    component: COMPONENT,
    basis: 'source_declared',
    artifactBinding: null,
    gaps: [],
    evidence: EVIDENCE,
  },
  {
    id: ENTRY,
    kind: 'entry',
    logicalId: 'test:endpoint',
    method: 'POST',
    path: ENDPOINT,
    implementation: 's2/http',
    evidence: EVIDENCE,
  },
  {
    id: CONTRACT,
    kind: 'interface_contract',
    component: COMPONENT,
    protocol: 'http',
    name: 'Synthetic service call',
    method: 'POST',
    path: ENDPOINT,
    authority: 'source_declared',
    request: [],
    responses: [],
    gaps: [],
    evidence: EVIDENCE,
  },
  {
    id: 'test/exposes',
    kind: 'entry_binding',
    entry: ENTRY,
    execution: 'test/runs',
    contract: CONTRACT,
    gaps: [],
    evidence: EVIDENCE,
  },
  {
    id: RESOURCE,
    kind: 'resource',
    label: 'Synthetic HTTP destination',
    technology: 'HTTP',
    declaredDatabase: null,
    physicalLocation: null,
    shapes: [],
    gaps: [],
    evidence: EVIDENCE,
  },
  {
    id: 'test/resource-binding',
    kind: 'resource_binding',
    resource: RESOURCE,
    component: COMPONENT,
    role: 'remote_interface',
    gaps: [],
    evidence: EVIDENCE,
  },
  {
    id: 'test/effect',
    kind: 'effect',
    owner: 's2/publish',
    operation: 's2/publish.attempt',
    effect: 'call',
    resource: RESOURCE,
    modality: 'source_traced',
    representation: 'logical',
    selection: [],
    payload: [],
    evidence: EVIDENCE,
  },
  {
    id: 'test/interaction',
    kind: 'interaction',
    owner: 's2/publish',
    execution: 'u3/runs/s2-publish',
    operation: 's2/publish.attempt',
    target: COMPONENT,
    targetEntry: ENTRY,
    contract: CONTRACT,
    effect: 'test/effect',
    handoff: null,
    mode: 'request_response',
    boundary: 'network',
    waitsFor: 'response',
    condition: 'Synthetic call',
    requestBindings: [],
    responseBindings: [],
    gaps: [],
    evidence: EVIDENCE,
  },
];

export function syntheticServiceRecords(
  bundle: KnowledgeBundle,
  parse: (input: unknown) => KnowledgeRecord,
): KnowledgeRecord[] {
  return [...bundle.records, ...RECORDS.map(parse)];
}
