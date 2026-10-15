// What a key press asks the plan viewer to do. Pure, so the table is tested without a browser.

export type KeyAction =
  | 'palette'
  | 'plans'
  | 'cheat'
  | 'next'
  | 'previous'
  | 'nextChapter'
  | 'previousChapter'
  | 'theme'
  | 'mode';

export interface KeyPress {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
}

const PLAIN: Readonly<Record<string, KeyAction | undefined>> = {
  j: 'next',
  ArrowRight: 'next',
  k: 'previous',
  ArrowLeft: 'previous',
  J: 'nextChapter',
  K: 'previousChapter',
  t: 'theme',
  T: 'theme',
  d: 'mode',
  D: 'mode',
  '?': 'cheat',
  '/': 'palette',
};

function commandAction({ key, shiftKey }: KeyPress): KeyAction | null {
  const lower = key.toLowerCase();
  if (shiftKey && lower === 'p') return 'plans';
  if (!shiftKey && lower === 'k') return 'palette';
  return null;
}

/** The action a key press stands for, or null when it is not one of the viewer's keys. */
export function keyAction(press: KeyPress): KeyAction | null {
  if (press.metaKey || press.ctrlKey) return commandAction(press);
  if (press.altKey) return null;
  const action = PLAIN[press.key] ?? null;
  // Shift only counts where it makes the key: J and K, and the ? it takes to type one.
  if (press.shiftKey && (action === 'next' || action === 'previous')) return null;
  return action;
}

/** The keys as the cheat sheet lists them, in the order a reader needs them. */
export const SHORTCUTS: readonly { readonly keys: readonly string[]; readonly label: string }[] = [
  { keys: ['→', 'j'], label: 'Next screen or step' },
  { keys: ['←', 'k'], label: 'Previous screen or step' },
  { keys: ['⇧J'], label: 'Next chapter' },
  { keys: ['⇧K'], label: 'Previous chapter' },
  { keys: ['/', '⌘K'], label: 'Search the plan' },
  { keys: ['⌘⇧P'], label: 'Switch plan' },
  { keys: ['T'], label: 'Theme: system, light or dark' },
  {
    keys: ['D'],
    label: 'Switch a walk between today and the plan, or a reference page between its views',
  },
  { keys: ['⌥'], label: 'Hold to see today on a What changes screen' },
  { keys: ['?'], label: 'This list' },
  { keys: ['Esc'], label: 'Close the dialog, menu or inspector on top' },
];
