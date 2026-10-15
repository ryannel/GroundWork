'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { PALETTE_EVENT } from './palette.client';
import { leaveFor, walkMove, walkToggle } from './walk-keys';

interface KeysProps {
  readonly previous: string | null;
  readonly next: string | null;
}

const typing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

const isSearch = (event: KeyboardEvent): boolean =>
  event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key === 'k');

const NEXT_KEYS = new Set(['j', 'ArrowRight']);
const PREVIOUS_KEYS = new Set(['k', 'ArrowLeft']);

function step(by: -1 | 1, to: string | null, router: { push: (href: string) => void }): void {
  if (walkMove(by) || to === null) return;
  leaveFor(to, by);
  router.push(to);
}

// j or → for the next step or screen, k or ← for the previous, d to switch a walk between today and the plan,
// / or ⌘K for the palette. Esc is each layer's own: the palette is a dialog, and the inspector listens for it
// while it is open.
export function PlanKeys({ previous, next }: KeysProps) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (typing(event.target) || event.altKey || document.querySelector('dialog[open]')) return;
      if (isSearch(event)) {
        event.preventDefault();
        globalThis.dispatchEvent(new Event(PALETTE_EVENT));
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      if (NEXT_KEYS.has(event.key)) step(1, next, router);
      if (PREVIOUS_KEYS.has(event.key)) step(-1, previous, router);
      if (event.key === 'd' && walkToggle()) event.preventDefault();
    };
    globalThis.addEventListener('keydown', onKey);
    return () => {
      globalThis.removeEventListener('keydown', onKey);
    };
  }, [next, previous, router]);
  return null;
}
