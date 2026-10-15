const linesIn = (root: HTMLElement): HTMLDetailsElement[] => [
  ...root.querySelectorAll<HTMLDetailsElement>('details[data-event]'),
];

/** Closes the line the last step opened, the one marked current, and marks none current. */
export function closeLast(root: HTMLElement): void {
  for (const line of linesIn(root)) {
    if (line.dataset.current !== undefined) line.open = false;
    delete line.dataset.current;
  }
}

/**
 * Opens the event line for `key` inside `root`, marks it current and brings it into view, and closes the line the
 * last step opened. A line the reader opened by hand stays open. Returns false when the page does not show that
 * event.
 */
export function showEvent(root: HTMLElement, key: string): boolean {
  const line = linesIn(root).find((d) => d.dataset.event === key);
  if (line?.dataset.current === undefined) closeLast(root);
  if (line === undefined) return false;
  line.open = true;
  line.dataset.current = '';
  line.scrollIntoView({ block: 'nearest' });
  return true;
}
