import type { Interaction, InterfaceContract, KnowledgeRecord } from './knowledge.generated';

type Records = ReadonlyMap<string, KnowledgeRecord>;

function sameSourceAddress(caller: InterfaceContract, provider: InterfaceContract): boolean {
  if (caller.authority !== 'caller_construction' || provider.authority !== 'source_declared') {
    return false;
  }
  if (!['http', 'https', 'grpc'].includes(caller.protocol)) return false;
  if (caller.method === null || caller.path === null) return false;
  return (
    caller.component === provider.component &&
    caller.protocol === provider.protocol &&
    caller.method === provider.method &&
    caller.path === provider.path
  );
}

function matchingExposure(record: Interaction, byId: Records): boolean {
  const caller = byId.get(record.contract);
  if (caller?.kind !== 'interface_contract') return false;
  for (const exposure of byId.values()) {
    if (exposure.kind !== 'entry_binding' || exposure.entry !== record.targetEntry) continue;
    const provider = byId.get(exposure.contract);
    if (
      provider?.kind === 'interface_contract' &&
      provider.component === record.target &&
      (provider.id === caller.id || sameSourceAddress(caller, provider))
    ) {
      return true;
    }
  }
  return false;
}

/** Endpoint correspondence retains both contracts; it does not establish payload compatibility. */
export function interactionTargetProblems(record: Interaction, byId: Records): string[] {
  const contract = byId.get(record.contract);
  if (contract?.kind !== 'interface_contract') return [];
  const errors: string[] = [];
  if (record.target !== contract.component) {
    errors.push(`${record.id}: target component must agree with contract`);
  }
  if (record.target !== null && contract.authority === 'candidate') {
    errors.push(`${record.id}: candidate contract cannot establish a runtime target`);
  }
  if (record.targetEntry !== null && !matchingExposure(record, byId)) {
    errors.push(`${record.id}: target entry requires a matching contract exposure`);
  }
  if (record.target === null && record.gaps.length === 0) {
    errors.push(`${record.id}: unresolved target requires a gap`);
  }
  return errors;
}
