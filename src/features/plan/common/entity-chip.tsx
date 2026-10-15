import type { Model } from '@/application/plan/derive';
import type { ElementStatus } from '@/application/plan/derive-core';
import { chipInfo } from '@/application/plan-chips';
import { Chip, ChipList } from '@/ui/chip';
import { Mention } from '@/ui/mention';

interface EntityChipProps {
  readonly model: Model;
  readonly id: string;
  /** Says it in other words than the plan's label. */
  readonly label?: string;
  /** Overrides the status the plan gives it. */
  readonly status?: ElementStatus;
}

// One thing in the plan as a chip: its glyph, label and status, and a click that opens it in the inspector.
export function EntityChip({ model, id, label, status }: EntityChipProps) {
  const info = chipInfo(model, id);
  return (
    <Chip
      glyph={info.glyph}
      id={id}
      label={info.number === '' ? (label ?? info.label) : `${info.number} ${label ?? info.label}`}
      mono={info.mono}
      status={status ?? info.status}
    />
  );
}

interface EntityChipsProps {
  readonly model: Model;
  /** Ids, or records that carry one. */
  readonly ids: readonly (string | { readonly id: string })[];
}

/** A row of chips; nothing when there are none. */
export function EntityChips({ model, ids }: EntityChipsProps) {
  const list = [
    ...new Set(ids.map((x) => (typeof x === 'string' ? x : x.id)).filter((id) => id !== '')),
  ];
  if (list.length === 0) return null;
  return (
    <ChipList>
      {list.map((id) => (
        <EntityChip id={id} key={id} model={model} />
      ))}
    </ChipList>
  );
}

/** One thing named inside running text, as an underlined mention rather than a chip. */
export function EntityMention({ model, id, label, status }: EntityChipProps) {
  const info = chipInfo(model, id);
  return (
    <Mention
      glyph={info.glyph}
      id={id}
      label={info.number === '' ? (label ?? info.label) : `${info.number} ${label ?? info.label}`}
      mono={info.mono}
      status={status ?? info.status}
    />
  );
}
