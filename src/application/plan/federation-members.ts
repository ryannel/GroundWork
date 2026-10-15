import { createCompat } from '@/application/plan/compat';
import type { Core } from '@/application/plan/derive-core';
import type { Delivery } from '@/application/plan/derive-delivery';
import type { DiffEntry } from '@/application/plan/derive-diff';
import type { createLadder } from '@/application/plan/derive-ladder';
import type { Owners } from '@/application/plan/derive-owners';
import { createGraphDiff } from '@/application/plan/federation-diff';
import { createFederation, createOperationLookups } from '@/application/plan/federation-model';
import { createFieldLadder } from '@/application/plan/field-ladder';
import { typeOf } from '@/application/plan/ids';

interface Parts {
  owners: Owners;
  delivery: Delivery;
  versions: (id: string) => { replacedBy: string | null };
  opSummary: (changeId: string | undefined, opIndex: number) => string;
  diff: (id: string) => DiffEntry[];
  /** The ladder of messages, endpoints and the like; a field that moves between subgraphs has its own. */
  ladder: ReturnType<typeof createLadder>;
}

/** What the federated graphs add to the model: query plans, cache paths, graph diffs, field ladders, compatibility. */
export function createFederationMembers(core: Core, parts: Parts) {
  const { owners, delivery, opSummary } = parts;
  const fieldLadders = createFieldLadder(core, { owners, delivery, opSummary });
  const federation = createFederation(core);
  const lookups = createOperationLookups(core, federation);
  const compatibility = createCompat({
    asIs: core.asIs,
    toBe: core.toBe,
    records: core.records,
    status: core.status,
    versions: parts.versions,
    operationsSelecting: lookups.operationsSelecting,
  });
  return {
    ...federation,
    ...lookups,
    graphDiff: createGraphDiff(core, {
      fed: { ...federation, ...lookups },
      diff: parts.diff,
      descendants: owners.descendants,
    }),
    fieldLadder: fieldLadders.fieldLadder,
    ladder: (id: string) =>
      typeOf(id) === 'field' && fieldLadders.movesField(id)
        ? fieldLadders.fieldLadder(id)
        : parts.ladder(id),
    compat: compatibility.compat,
    netDiff: compatibility.netDiff,
  };
}
