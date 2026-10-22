import type { ChipRef } from '@/application/today-scope';
import { Chip, ChipList } from '@/ui/chip';

/** One thing named as a chip the inspector opens. */
export function RefChip({ chip }: { readonly chip: ChipRef }) {
  return <Chip glyph={chip.glyph} id={chip.id} label={chip.label} mono={chip.mono} />;
}

export function RefChips({ chips }: { readonly chips: readonly ChipRef[] }) {
  return (
    <ChipList>
      {chips.map((chip) => (
        <RefChip chip={chip} key={chip.id} />
      ))}
    </ChipList>
  );
}
