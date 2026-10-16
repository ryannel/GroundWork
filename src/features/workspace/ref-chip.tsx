import type { ChipRef } from '@/application/today-scope';
import { Chip, ChipList } from '@/ui/chip';

/** One thing by name; clicking it opens the inspector. */
export function RefChip({ chip }: { readonly chip: ChipRef }) {
  return <Chip glyph={chip.glyph} id={chip.id} label={chip.label} mono={chip.mono} />;
}

/** A row of things, or nothing when there are none. */
export function RefChips({ chips }: { readonly chips: readonly ChipRef[] }) {
  if (chips.length === 0) return null;
  return (
    <ChipList>
      {chips.map((chip) => (
        <RefChip chip={chip} key={chip.id} />
      ))}
    </ChipList>
  );
}
