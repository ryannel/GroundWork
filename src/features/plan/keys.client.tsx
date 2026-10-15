'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { cycleTheme } from '@/ui/theme-toggle.client';

import { toggleCheatSheet } from './cheat-sheet.client';
import { keyAction, type KeyAction } from './keys';
import { PALETTE_EVENT } from './palette.client';
import { holdPeek, PEEK_ROOT } from './peek';
import { PLANS_EVENT } from './plan-switch.client';
import { leaveFor, walkMove, walkToggle } from './walk-keys';

interface KeysProps {
  readonly previous: string | null;
  readonly next: string | null;
  /** The first screen of the chapters either side. */
  readonly previousChapter: string | null;
  readonly nextChapter: string | null;
}

interface Router {
  readonly push: (href: string) => void;
}

const typing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

function step(by: -1 | 1, to: string | null, router: Router): void {
  if (walkMove(by) || to === null) return;
  leaveFor(to, by);
  router.push(to);
}

/** Choose the next of a page's views, such as a reference page's today, plan and difference. */
function cycleMode(): boolean {
  if (walkToggle()) return true;
  const radios = [
    ...document.querySelectorAll<HTMLInputElement>('[data-cycle] input[type="radio"]'),
  ];
  if (radios.length < 2) return false;
  const at = radios.findIndex((radio) => radio.checked);
  radios[(at + 1) % radios.length]?.click();
  return true;
}

const ACTIONS: Record<KeyAction, (props: KeysProps, router: Router) => boolean> = {
  palette: () => globalThis.dispatchEvent(new Event(PALETTE_EVENT)),
  plans: () => globalThis.dispatchEvent(new Event(PLANS_EVENT)),
  cheat: () => {
    toggleCheatSheet();
    return true;
  },
  next: (props, router) => {
    step(1, props.next, router);
    return true;
  },
  previous: (props, router) => {
    step(-1, props.previous, router);
    return true;
  },
  nextChapter: (props, router) => go(props.nextChapter, router),
  previousChapter: (props, router) => go(props.previousChapter, router),
  theme: () => {
    cycleTheme();
    return true;
  },
  mode: () => cycleMode(),
};

function go(to: string | null, router: Router): boolean {
  if (to !== null) router.push(to);
  return to !== null;
}

function onAlt(event: KeyboardEvent): boolean {
  if (event.key !== 'Alt') return false;
  if (event.type === 'keyup') holdPeek(false);
  else if (document.querySelector(PEEK_ROOT) !== null) holdPeek(true);
  return true;
}

// The viewer's keys, as the cheat sheet (?) lists them. Nothing fires while typing, and with a dialog open only ?
// does, to swap to the list. Esc is each layer's own: dialogs close themselves, and menus and the inspector
// listen for it while open.
export function PlanKeys({ previous, next, previousChapter, nextChapter }: KeysProps) {
  const router = useRouter();
  useEffect(() => {
    const props = { previous, next, previousChapter, nextChapter };
    const onKey = (event: KeyboardEvent): void => {
      if (onAlt(event) || event.type === 'keyup' || typing(event.target)) return;
      const action = keyAction(event);
      if (action === null) return;
      if (document.querySelector('dialog[open]') !== null && action !== 'cheat') return;
      if (ACTIONS[action](props, router)) event.preventDefault();
    };
    const letGo = (): void => {
      holdPeek(false);
    };
    globalThis.addEventListener('keydown', onKey);
    globalThis.addEventListener('keyup', onKey);
    globalThis.addEventListener('blur', letGo);
    return () => {
      globalThis.removeEventListener('keydown', onKey);
      globalThis.removeEventListener('keyup', onKey);
      globalThis.removeEventListener('blur', letGo);
    };
  }, [previous, next, previousChapter, nextChapter, router]);
  return null;
}
