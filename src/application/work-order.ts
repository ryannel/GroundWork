interface WorkItem {
  readonly id: string;
  readonly milestone?: string;
  readonly depends_on?: readonly string[];
}
/** Dependencies first, then declared milestone order and authored order; invalid cycles retain their rows last. */
export function workOrderOf<Item extends WorkItem>(
  items: readonly Item[],
  milestones: readonly { readonly id: string }[],
): readonly Item[] {
  const ranks = new Map(milestones.map((milestone, position) => [milestone.id, position]));
  const rank = (item: Item): number => ranks.get(item.milestone ?? '') ?? 1e9;
  const known = new Set(items.map((item) => item.id));
  const pending = items.toSorted((left, right) => rank(left) - rank(right));
  const done = new Set<string>();
  const ordered: Item[] = [];
  while (pending.length > 0) {
    const position = pending.findIndex((item) =>
      (item.depends_on ?? []).filter((id) => known.has(id)).every((id) => done.has(id)),
    );
    const next = position === -1 ? undefined : pending.splice(position, 1)[0];
    if (next === undefined) break;
    ordered.push(next);
    done.add(next.id);
  }
  return [...ordered, ...pending];
}
