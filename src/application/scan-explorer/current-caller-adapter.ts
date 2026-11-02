import type { ExplorerIndex } from '@/domain/scan-explorer/contracts';
import { explorerContract } from '@/domain/scan-explorer/correspondence';
import type { CurrentAddress } from '@/domain/scan-explorer/current-connections';

/** Retained callers keep their canonical provenance while matching current provider declarations. */
export function retainedCallerAddresses(index: ExplorerIndex): CurrentAddress[] {
  return index.interactions.flatMap((located) => {
    const contract = explorerContract(index, located.snapshot, located.record.contract)?.record;
    if (contract?.authority !== 'caller_construction') return [];
    if (contract.method === null || contract.path === null) return [];
    if (located.record.boundary !== 'network') return [];
    const component =
      index.components.find((item) => item.record.id === located.record.target)?.record.logicalId ??
      null;
    return [
      {
        snapshot: located.snapshot,
        origin: 'knowledge/v3',
        record: located.record.id,
        component,
        protocol: contract.protocol,
        method: contract.method,
        path: contract.path,
        authority: 'caller_construction',
        sourceIds: located.record.evidence,
        version: contract.version ?? null,
      } satisfies CurrentAddress,
    ];
  });
}
