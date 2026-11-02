import type { KnowledgeReader } from '@/domain/knowledge/knowledge-reader';
import type {
  Evidence,
  Interaction,
  InterfaceContract,
} from '@/domain/knowledge/knowledge.generated';
import type { OutboundBinding, Source } from '@/domain/scan/scan.generated';
import type { ExplorerIndex } from '@/domain/scan-explorer/contracts';
import { explorerContract } from '@/domain/scan-explorer/correspondence';
import type {
  CurrentScanInput,
  CurrentTargetBinding,
} from '@/domain/scan-explorer/current-contracts';

function sameAnchor(source: Source, evidence: Evidence): boolean {
  const revision = source.repo === evidence.repo && source.commit === evidence.commit;
  const range = source.lines[0] === evidence.lines[0] && source.lines[1] === evidence.lines[1];
  return revision && range && source.path === evidence.path;
}

function anchored(
  reader: KnowledgeReader,
  ids: readonly string[],
  sources: readonly Source[],
): boolean {
  const evidence = ids.map((id) => reader.get(id)).filter((record) => record?.kind === 'evidence');
  return evidence.some((record) => sources.some((source) => sameAnchor(source, record)));
}

function targetBinding(
  index: ExplorerIndex,
  located: ExplorerIndex['interactions'][number],
  current: {
    readonly source: Source;
    readonly outbound: OutboundBinding;
  },
): CurrentTargetBinding[] {
  const { record, snapshot } = located;
  const reader = selectedReader(index, snapshot);
  if (reader === undefined || !establishedNetworkTarget(record)) return [];
  if (!anchored(reader, record.evidence, [current.source])) return [];
  const contract = explorerContract(index, snapshot, record.contract)?.record;
  const target = index.components.find((item) => item.record.id === record.target)?.record;
  if (contract?.authority !== 'caller_construction') return [];
  if (target === undefined) return [];
  if (!sameCallAddress(contract, current.outbound)) return [];
  if (current.outbound.request.template === null) return [];
  return [
    {
      outbound: current.outbound.id,
      component: target.logicalId,
      protocol: contract.protocol,
      method: current.outbound.request.method,
      path: current.outbound.request.template,
      sourceIds: [current.source.id],
      basis: 'canonical_source_correspondence',
      canonicalInteraction: record.id,
      canonicalSnapshot: snapshot,
      componentRecord: target.id,
      version: contract.version ?? null,
    },
  ];
}

/** Reconcile a newly extracted call only with the exact retained canonical call-site anchor. */
export function currentTargetsFromCanonical(
  input: CurrentScanInput,
  index: ExplorerIndex,
): readonly CurrentTargetBinding[] {
  return input.records
    .filter((record) => record.kind === 'outbound_binding')
    .flatMap((outbound) => {
      const source = input.sources.find((item) => item.id === outbound.source);
      return source === undefined
        ? []
        : index.interactions.flatMap((located) =>
            targetBinding(index, located, { source, outbound }),
          );
    });
}

/** Provider protocol is restored only from the same pinned route declaration and source address. */
export function currentProvidersFromCanonical(
  input: CurrentScanInput,
  index: ExplorerIndex,
): NonNullable<CurrentScanInput['providers']> {
  const routes = input.records.filter(
    (record) => record.kind === 'route_binding' || record.kind === 'aspnet_route_binding',
  );
  return routes.flatMap((route) => {
    const ids = route.kind === 'route_binding' ? route.source_ids : route.support;
    const sources = input.sources.filter((source) => ids.includes(source.id));
    const methods: readonly string[] =
      route.kind === 'route_binding' ? [route.http_method] : route.httpMethods;
    const path = route.kind === 'route_binding' ? route.path : route.template;
    return index.entries.flatMap((located) => {
      const reader = index.selections.find(
        (item) => item.reader.snapshot === located.snapshot,
      )?.reader;
      if (reader === undefined || !anchored(reader, located.record.evidence, sources)) return [];
      const contract = explorerContract(index, located.snapshot, located.record.contract)?.record;
      if (contract?.authority !== 'source_declared') return [];
      if (!sameProviderAddress(contract, { path, methods })) return [];
      const component = index.components.find(
        (item) => item.record.id === contract.component,
      )?.record;
      if (component?.logicalId !== input.binding.component.logicalId) return [];
      return [
        {
          entry: route.id,
          protocol: contract.protocol,
          sourceIds: ids,
          canonicalEntry: located.record.id,
          canonicalSnapshot: located.snapshot,
          version: contract.version ?? null,
        },
      ];
    });
  });
}

function establishedNetworkTarget(record: Interaction): boolean {
  return record.target !== null && record.boundary === 'network';
}

function sameCallAddress(contract: InterfaceContract, outbound: OutboundBinding): boolean {
  return contract.method === outbound.request.method && contract.path === outbound.request.template;
}
function sameProviderAddress(
  contract: InterfaceContract,
  address: { readonly path: string | null; readonly methods: readonly string[] },
): boolean {
  return (
    contract.path === address.path &&
    contract.method !== null &&
    address.methods.includes(contract.method)
  );
}

function selectedReader(index: ExplorerIndex, snapshot: string): KnowledgeReader | undefined {
  return index.selections.find((item) => item.reader.snapshot === snapshot)?.reader;
}
