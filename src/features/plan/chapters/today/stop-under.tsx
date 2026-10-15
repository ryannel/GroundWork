import type { Model } from '@/application/plan/derive';
import type { StopBelow } from '@/application/plan-story-today-types';
import { EntityChip } from '@/features/plan/common/entity-chip';
import { StoreGrid } from '@/features/plan/viz/store-grid/store-grid';
import { ChipList } from '@/ui/chip';

import { StoreList } from './store-list';
import { TeamStrip } from './team-strip';

// What sits under the system map at one stop: the teams, a few chips, or the stores.
export function StopUnder({ model, below }: { readonly model: Model; readonly below: StopBelow }) {
  switch (below.kind) {
    case 'teams': {
      return <TeamStrip idle={below.idle} model={model} rows={below.rows} />;
    }
    case 'chips': {
      if (below.chips.length === 0) return null;
      return (
        <ChipList>
          {below.chips.map((chip) => (
            <EntityChip id={chip.id} key={chip.id} label={chip.label} model={model} />
          ))}
        </ChipList>
      );
    }
    case 'stores': {
      return (
        <>
          <StoreList model={model} stores={below.stores} />
          {below.grid ? <StoreGrid compact model={model} /> : null}
        </>
      );
    }
  }
}
