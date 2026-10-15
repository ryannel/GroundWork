// What the reader opened and chose stays put while they read: a fold they opened is open on the next step, and
// the view they picked is the one shown. It lasts until the page is reloaded.

const folds = new Map<string, boolean>();
const choices = new Map<string, string>();

/** Opens or closes each `details[data-keep]` inside the box as the reader last left one of its name. */
export function applyFolds(box: HTMLElement): void {
  for (const el of box.querySelectorAll<HTMLDetailsElement>('details[data-keep]')) {
    const open = folds.get(el.dataset.keep ?? '');
    if (open !== undefined && el.open !== open) el.open = open;
  }
}

function toggle(event: Event): void {
  const el = event.target;
  if (el instanceof HTMLDetailsElement && el.dataset.keep !== undefined)
    folds.set(el.dataset.keep, el.open);
}

/** Remembers the folds the reader opens and closes inside the box; returns the way to stop. */
export function keepFolds(box: HTMLElement): () => void {
  box.addEventListener('toggle', toggle, true);
  return () => {
    box.removeEventListener('toggle', toggle, true);
  };
}

export function keptChoice(name: string): string | undefined {
  return choices.get(name);
}

export function keepChoice(name: string, value: string): void {
  choices.set(name, value);
}
