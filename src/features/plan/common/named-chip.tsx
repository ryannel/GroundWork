import type { Model } from '@/application/plan/derive';
import { carriesStatus } from '@/application/plan-viz-named';
import { ChipList } from '@/ui/chip';

import { EntityChip } from './entity-chip';
import { ServiceChip } from './service-chip';

interface NamedChipProps {
  readonly model: Model;
  readonly id: string;
  readonly label?: string;
  /** Leads with the team's colour dot. */
  readonly team?: boolean;
}

/**
 * A chip named for the thing, never marked by status where status would mislead: a test or a work item is not a system
 * element, and a green chip would read as "added".
 */
export function NamedChip({ model, id, label, team = false }: NamedChipProps) {
  if (team) return <ServiceChip id={id} model={model} />;
  const text = label === undefined ? {} : { label };
  if (carriesStatus(id)) return <EntityChip id={id} model={model} {...text} />;
  return <EntityChip id={id} model={model} status="existing" {...text} />;
}

interface NamedChipsProps {
  readonly model: Model;
  readonly ids: readonly string[];
  readonly team?: boolean;
}

/** A wrapping row of named chips; nothing when there are none. */
export function NamedChips({ model, ids, team = false }: NamedChipsProps) {
  if (ids.length === 0) return null;
  return (
    <ChipList>
      {ids.map((id) => (
        <NamedChip id={id} key={id} model={model} team={team} />
      ))}
    </ChipList>
  );
}
