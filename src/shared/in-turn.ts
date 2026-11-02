/** Runs a step for each item, one after another, in order: for work that must not overlap, like a stream's writes. */
export async function inTurn<T>(
  items: readonly T[],
  step: (item: T) => Promise<void>,
): Promise<void> {
  await items.reduce<Promise<void>>(async (previous, item) => {
    await previous;
    await step(item);
  }, Promise.resolve());
}
