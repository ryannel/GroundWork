import type { EntryBinding, InterfaceContract } from '@/domain/knowledge/knowledge.generated';

import type { Correspondence, ExplorerIndex, Located } from './contracts';

export function explorerContract(
  index: ExplorerIndex,
  snapshot: string,
  id: string,
): Located<InterfaceContract> | null {
  const record = index.selections.find((item) => item.reader.snapshot === snapshot)?.reader.get(id);
  return record?.kind === 'interface_contract' ? { snapshot, record } : null;
}

function sameAddress(caller: InterfaceContract, provider: InterfaceContract): boolean {
  if (!['http', 'https', 'grpc'].includes(caller.protocol)) return false;
  if (caller.method === null || caller.path === null) return false;
  return (
    caller.protocol === provider.protocol &&
    caller.method === provider.method &&
    caller.path === provider.path
  );
}

function sameTarget(
  index: ExplorerIndex,
  target: string | null,
  provider: InterfaceContract,
): boolean {
  if (target === null || provider.component === null) return false;
  if (target === provider.component) return true;
  const callerHost = index.components.find((item) => item.record.id === target);
  const providerHost = index.components.find((item) => item.record.id === provider.component);
  return callerHost !== undefined && callerHost.record.logicalId === providerHost?.record.logicalId;
}

function sameVersion(caller: InterfaceContract, provider: InterfaceContract): boolean {
  return (caller.version ?? null) === (provider.version ?? null);
}

function matchProvider(
  index: ExplorerIndex,
  pair: {
    readonly item: ExplorerIndex['interactions'][number];
    readonly caller: Located<InterfaceContract>;
  },
  provider: Located<EntryBinding>,
): Correspondence | null {
  const { item, caller } = pair;
  const contract = explorerContract(index, provider.snapshot, provider.record.contract);
  if (contract === null || !sameAddress(caller.record, contract.record)) return null;
  const target = sameTarget(index, item.record.target, contract.record);
  const authority =
    caller.record.authority === 'caller_construction' &&
    contract.record.authority === 'source_declared';
  const shared =
    caller.record.id === contract.record.id && contract.record.authority === 'source_declared';
  const version = sameVersion(caller.record, contract.record);
  const acceptedAuthority = authority || shared;
  const confirmed = target && acceptedAuthority && version;
  return {
    interaction: item,
    callerContract: caller,
    provider,
    providerContract: contract,
    status: confirmed ? 'confirmed' : 'candidate',
    payloadCompatibility: 'not_checked',
    reasons: [
      target
        ? 'Established technical target identity'
        : 'Target identity is unestablished; similar address only',
      version
        ? 'Source contract versions agree or are undeclared'
        : 'Source contract versions differ',
      'Source address correspondence does not prove deployment or payload compatibility',
    ],
  };
}

export function interactionCorrespondence(
  index: ExplorerIndex,
  item: ExplorerIndex['interactions'][number],
): readonly Correspondence[] {
  const caller = explorerContract(index, item.snapshot, item.record.contract);
  const matches =
    caller === null
      ? []
      : index.entries.flatMap((provider) => {
          const match = matchProvider(index, { item, caller }, provider);
          return match === null ? [] : [match];
        });
  const established = matches.filter((match) => match.status === 'confirmed');
  if (established.length > 1) {
    return matches.map((match) =>
      match.status === 'confirmed'
        ? {
            ...match,
            status: 'ambiguous',
            reasons: [...match.reasons, 'Multiple source entries expose this target address'],
          }
        : match,
    );
  }
  if (matches.length > 0) return matches;
  return [
    {
      interaction: item,
      callerContract: caller,
      provider: null,
      providerContract: null,
      status: 'unresolved',
      reasons: ['No matching provider exposure in the selected source scope'],
      payloadCompatibility: 'not_checked',
    },
  ];
}
