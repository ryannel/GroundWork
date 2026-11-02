import type { CurrentRecord, CurrentScanInput, CurrentTargetBinding } from './current-contracts';

const UNRESOLVED_PROTOCOL = 'http-unresolved';

export interface CurrentAddress {
  readonly snapshot: string;
  readonly origin?: 'scan/v1' | 'knowledge/v3';
  readonly record: string;
  readonly component: string | null;
  readonly protocol: string;
  readonly method: string;
  readonly path: string | null;
  readonly authority: 'source_declared' | 'caller_construction';
  readonly sourceIds: readonly string[];
  readonly version?: string | null;
  readonly targetResolution?: 'established' | 'ambiguous' | 'unresolved';
  readonly canonicalSupport?: readonly { readonly snapshot: string; readonly record: string }[];
}

export interface CurrentCorrespondence {
  readonly caller: CurrentAddress;
  readonly provider: CurrentAddress | null;
  readonly status: 'confirmed' | 'candidate' | 'ambiguous' | 'unresolved';
  readonly reasons: readonly string[];
}

/** The source scan does not yet establish configured target identity or negotiated transport. */
function currentAddresses(input: CurrentScanInput): readonly CurrentAddress[] {
  const bound = new Set(
    input.sources
      .filter(
        (source) =>
          source.repo === input.binding.repo &&
          source.commit === input.binding.commit &&
          input.binding.modulePaths.some(
            (path) => path.endsWith('/') && source.path.startsWith(path),
          ),
      )
      .map((source) => source.id),
  );
  return input.records
    .filter((record) => belongs(record, bound))
    .flatMap((record) => address(input, record));
}

function belongs(record: CurrentRecord, bound: ReadonlySet<string>): boolean {
  if (record.kind === 'route_binding') return record.source_ids.some((id) => bound.has(id));
  return 'source' in record && bound.has(record.source);
}

function address(input: CurrentScanInput, record: CurrentRecord): CurrentAddress[] {
  if (record.kind === 'route_binding') {
    return [
      {
        snapshot: input.snapshot,
        record: record.id,
        component: input.binding.component.logicalId,
        protocol: providerBinding(input, record.id)?.protocol ?? UNRESOLVED_PROTOCOL,
        method: record.http_method,
        path: record.path,
        authority: 'source_declared',
        sourceIds: record.source_ids,
      },
    ];
  }
  if (record.kind === 'aspnet_route_binding') {
    return record.httpMethods.map((method) => ({
      snapshot: input.snapshot,
      record: record.id,
      component: input.binding.component.logicalId,
      protocol: providerBinding(input, record.id)?.protocol ?? UNRESOLVED_PROTOCOL,
      version: providerBinding(input, record.id)?.version ?? null,
      method,
      path: record.template,
      authority: 'source_declared',
      sourceIds: record.support,
    }));
  }
  if (record.kind === 'outbound_binding') return outboundAddress(input, record);
  return [];
}

function outboundAddress(
  input: CurrentScanInput,
  record: Extract<CurrentRecord, { readonly kind: 'outbound_binding' }>,
): CurrentAddress[] {
  const matches =
    input.targets?.filter(
      (target) =>
        target.outbound === record.id &&
        target.method === record.request.method &&
        target.path === record.request.template,
    ) ?? [];
  const mapping = unambiguousTarget(matches);

  return [
    {
      snapshot: input.snapshot,
      record: record.id,
      component: mapping?.component ?? null,
      targetResolution: targetResolution(matches, mapping),
      protocol: mapping?.protocol ?? UNRESOLVED_PROTOCOL,
      version: mapping?.version ?? null,
      canonicalSupport:
        mapping?.canonicalSnapshot === undefined
          ? []
          : [{ snapshot: mapping.canonicalSnapshot, record: mapping.canonicalInteraction }],
      method: record.request.method,
      path: record.request.template,
      authority: 'caller_construction',
      sourceIds: record.support,
    },
  ];
}

export function currentCorrespondence(
  inputs: readonly CurrentScanInput[],
  extra: readonly CurrentAddress[] = [],
): readonly CurrentCorrespondence[] {
  const addresses = [...inputs.flatMap(currentAddresses), ...extra];
  const providers = addresses.filter((item) => item.authority === 'source_declared');
  return addresses
    .filter((item) => item.authority === 'caller_construction')
    .flatMap((caller) => {
      const matches = providers.filter(
        (provider) =>
          caller.path !== null &&
          caller.path === provider.path &&
          caller.method === provider.method,
      );
      if (matches.length === 0) {
        return [
          {
            caller,
            provider: null,
            status: 'unresolved',
            reasons: [
              'No matching provider source address in the selected scope; configured runtime target remains unresolved',
            ],
          },
        ];
      }
      return matches.map((provider): CurrentCorrespondence => ({
        caller,
        provider,
        status: status(caller, provider, matches.length),
        reasons: [
          caller.component === provider.component
            ? 'Exact call-site canonical source correspondence establishes technical target; method and path match current provider'
            : 'Exact method and path are candidate evidence only',
          'Source correspondence does not establish payload compatibility or deployed version correspondence',
        ],
      }));
    });
}

function status(
  caller: CurrentAddress,
  provider: CurrentAddress,
  matches: number,
): CurrentCorrespondence['status'] {
  if (matches > 1 || caller.targetResolution === 'ambiguous') return 'ambiguous';
  const identity = caller.component === provider.component;
  const protocol = caller.protocol === provider.protocol && caller.protocol !== UNRESOLVED_PROTOCOL;
  const version = (caller.version ?? null) === (provider.version ?? null);
  return identity && protocol && version ? 'confirmed' : 'candidate';
}

function unambiguousTarget(
  mappings: readonly CurrentTargetBinding[],
): CurrentTargetBinding | undefined {
  const variants = new Set(
    mappings.map((mapping) =>
      JSON.stringify([mapping.component, mapping.protocol, mapping.version ?? null]),
    ),
  );
  return variants.size === 1 ? mappings[0] : undefined;
}
function providerBinding(
  input: CurrentScanInput,
  id: string,
): NonNullable<CurrentScanInput['providers']>[number] | undefined {
  const mappings = input.providers?.filter((provider) => provider.entry === id) ?? [];
  const variants = new Set(
    mappings.map((mapping) => JSON.stringify([mapping.protocol, mapping.version ?? null])),
  );
  return variants.size === 1 ? mappings[0] : undefined;
}

function targetResolution(
  matches: readonly CurrentTargetBinding[],
  mapping: CurrentTargetBinding | undefined,
): NonNullable<CurrentAddress['targetResolution']> {
  if (mapping !== undefined) return 'established';
  return matches.length > 0 ? 'ambiguous' : 'unresolved';
}
