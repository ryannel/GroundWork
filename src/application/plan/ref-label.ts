type Labeller = (id: string) => string | null;

/** A reference's authored label, or readable words from its id when it is unknown. */
export function refLabel(id: string, label?: Labeller): string {
  const found = label?.(id) ?? null;
  if (found !== null && found !== id) return found;
  const slug = id.replace(/^[a-z]+:/u, '');
  return (slug.split('#').pop() ?? slug).replaceAll(/[-_]/gu, ' ');
}

/** A resolver belonging to one model; deriving another model cannot change it. */
export function labelsOf(model: {
  readonly label: (id: string) => string;
}): (id: string) => string {
  return (id) => refLabel(id, model.label);
}
