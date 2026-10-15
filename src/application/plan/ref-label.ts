type Labeller = (id: string) => string | null;

let current: Labeller | null = null;

/**
 * Register how the current plan labels an id. Text flattened to plain words (titles, chips, search) reads
 * `[[id]]` through it; derive() registers the plan it works out, and `null` removes it.
 */
export function setRefLabel(labeller: Labeller | null): void {
  current = labeller;
}

/** The label of a bare `[[id]]`. Without a plan that knows it, the id's slug becomes words, so raw ids never reach the reader. */
export function refLabel(id: string): string {
  const label = current?.(id) ?? null;
  if (label !== null && label !== id) return label;
  const slug = id.replace(/^[a-z]+:/, '');
  return (slug.split('#').pop() ?? slug).replaceAll(/[-_]/g, ' ');
}
