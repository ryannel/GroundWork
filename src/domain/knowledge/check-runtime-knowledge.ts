import type {
  Entry,
  ExecutionBinding,
  InterfaceContract,
  KnowledgeRecord,
} from './knowledge.generated';
import { runtimeReferences } from './runtime-references';

type Records = ReadonlyMap<string, KnowledgeRecord>;
const sourceEntryContracts = {
  process: { protocol: 'process', method: 'PROCESS' },
  schedule: { protocol: 'timer', method: 'SCHEDULE' },
  startup: { protocol: 'lifecycle', method: 'STARTUP' },
  callback: { protocol: 'callback', method: 'CALLBACK' },
  rpc: { protocol: 'grpc', method: 'RPC' },
} satisfies Readonly<Record<string, { readonly protocol: string; readonly method: string }>>;

function executionProblems(record: ExecutionBinding, byId: Records): string[] {
  const implementation = byId.get(record.implementation);
  const component = byId.get(record.component);
  if (implementation?.kind !== 'implementation' || component?.kind !== 'runtime_component') {
    return [];
  }
  if (component.category !== 'service' && component.category !== 'app') {
    return [`${record.id}: only service or app components execute code`];
  }
  if (record.basis === 'source_declared') {
    return component.sources.includes(implementation.scope)
      ? []
      : [`${record.id}: foreign library code requires an exact artefact binding`];
  }
  return artifactExecution(record, implementation.scope, byId);
}

function artifactExecution(record: ExecutionBinding, scope: string, byId: Records): string[] {
  const binding = record.artifactBinding === null ? undefined : byId.get(record.artifactBinding);
  if (
    binding?.kind !== 'artifact_source_binding' ||
    binding.status !== 'exact' ||
    binding.source !== scope
  ) {
    return [`${record.id}: exact artefact source binding required`];
  }
  const artifact = byId.get(binding.artifact);
  return artifact?.kind === 'artifact' && artifact.digest !== null
    ? []
    : [`${record.id}: exact artefact digest required`];
}

function contractProblems(record: InterfaceContract): string[] {
  const parts = [...record.request, ...record.responses.map((response) => response.body)];
  const errors =
    new Set(record.request.map((part) => part.part)).size === record.request.length
      ? []
      : [`${record.id}: request contract parts must be unique`];
  return [
    ...errors,
    ...parts.flatMap((part) => {
      if (part.presence === 'none' && (part.shape !== null || part.sourceShape !== null)) {
        return [`${record.id}: absent contract parts must not assert a shape`];
      }
      if (part.presence === 'present' && part.shape === null && part.gaps.length === 0) {
        return [`${record.id}: unknown schema requires a gap`];
      }
      if (part.presence === 'unresolved' && part.gaps.length === 0) {
        return [`${record.id}: unresolved contract parts require a gap`];
      }
      return part.evidence.length === 0
        ? [`${record.id}: contract parts require source evidence`]
        : [];
    }),
  ];
}

function entryProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'entry_binding') return [];
  const entry = byId.get(record.entry);
  const execution = byId.get(record.execution);
  const contract = byId.get(record.contract);
  if (
    entry?.kind !== 'entry' ||
    execution?.kind !== 'execution_binding' ||
    contract?.kind !== 'interface_contract'
  ) {
    return [];
  }
  const contractErrors = exposureContractProblems(record.id, entry, contract);
  if (contractErrors.length > 0) return contractErrors;
  if (
    entry.implementation !== execution.implementation ||
    contract.component !== execution.component
  ) {
    return [`${record.id}: entry, host execution and contract must agree`];
  }
  return entryRouteProblems(record.id, entry, contract);
}

function entryRouteProblems(id: string, entry: Entry, contract: InterfaceContract): string[] {
  if (
    entry.trigger === 'rpc' &&
    !/^\/[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*\/[A-Za-z_]\w*$/u.test(entry.path)
  ) {
    return [`${id}: gRPC entry requires a full /service/method address`];
  }
  if (contract.method === entry.method && contract.path === entry.path) return [];
  const message =
    (entry.trigger ?? 'rest') === 'rest'
      ? 'REST contract must match the registered entry route'
      : 'Contract must match the registered source entry address';
  return [`${id}: ${message}`];
}

function exposureContractProblems(id: string, entry: Entry, contract: InterfaceContract): string[] {
  if (contract.authority !== 'source_declared') {
    return [`${id}: inbound exposure requires an established contract`];
  }
  const trigger = entry.trigger ?? 'rest';
  if (trigger === 'rest') {
    return contract.protocol === 'http' || contract.protocol === 'https'
      ? []
      : [`${id}: REST entry requires an HTTP contract`];
  }
  const expected = sourceEntryContracts[trigger];
  return contract.protocol === expected.protocol && entry.method === expected.method
    ? []
    : [
        `${id}: ${trigger} entry requires ${expected.protocol} protocol and ${expected.method} method`,
      ];
}

export function checkRuntimeKnowledge(record: KnowledgeRecord, byId: Records): string[] {
  const errors = runtimeReferences(record).flatMap(([id, kind]) =>
    byId.get(id)?.kind === kind ? [] : [`${record.id}: ${id} must reference ${kind}`],
  );
  if (record.kind === 'execution_binding') errors.push(...executionProblems(record, byId));
  if (record.kind === 'interface_contract') errors.push(...contractProblems(record));
  errors.push(...resourceBindingProblems(record, byId));
  return [...errors, ...entryProblems(record, byId)];
}

function resourceBindingProblems(record: KnowledgeRecord, byId: Records): string[] {
  if (record.kind !== 'resource_binding') return [];
  const component = byId.get(record.component);
  if (component?.kind !== 'runtime_component') return [];
  if (record.scope === 'in_process') {
    return ['service', 'app'].includes(component.category) && record.role !== 'remote_interface'
      ? []
      : [`${record.id}: in-process resources require storage or transport in a service or app`];
  }
  const roles: Readonly<Record<typeof record.role, readonly string[]>> = {
    storage: ['store'],
    transport: ['topic'],
    remote_interface: ['service', 'app', 'external'],
  };
  return roles[record.role].includes(component.category)
    ? []
    : [`${record.id}: runtime resource role does not match component category`];
}
