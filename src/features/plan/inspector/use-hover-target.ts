import { useEffect, useState } from 'react';

// Which [data-inspect] thing the reader is resting on: by pointer after 280ms of a real hover, or by keyboard focus
// after 120ms. A scroll, a click, Escape or leaving it lets go. Touch never asks: a tap opens the inspector.

const HOVER_MS = 280;
const FOCUS_MS = 120;
/** A pointerover with no move this close before it came from the page changing under a still pointer. */
const MOVED_MS = 400;

const targetIn = (node: EventTarget | null): HTMLElement | null => {
  const el = node instanceof Element ? node.closest('[data-inspect]') : null;
  return el instanceof HTMLElement && el.closest('[data-no-hover]') === null ? el : null;
};

/** A timer that shows one element after a wait, unless something else is asked for first. */
function delayed(set: (el: HTMLElement | null) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: HTMLElement | null = null;
  const show = (el: HTMLElement | null, wait: number): void => {
    if (el === null || el === pending) return;
    clearTimeout(timer);
    pending = el;
    timer = setTimeout(() => {
      if (pending === el && el.isConnected) set(el);
    }, wait);
  };
  const hide = (): void => {
    clearTimeout(timer);
    pending = null;
    set(null);
  };
  return { show, hide };
}

function watch(set: (el: HTMLElement | null) => void): () => void {
  const card = delayed(set);
  let lastMove = -Infinity;
  const onMove = (event: PointerEvent): void => {
    lastMove = event.timeStamp;
  };
  const onOver = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || event.timeStamp - lastMove > MOVED_MS) return;
    card.show(targetIn(event.target), HOVER_MS);
  };
  const onOut = (event: PointerEvent): void => {
    const from = targetIn(event.target);
    if (from === null) return;
    if (event.relatedTarget instanceof Node && from.contains(event.relatedTarget)) return;
    card.hide();
  };
  const onFocus = (event: FocusEvent): void => {
    const el = event.target;
    if (el instanceof HTMLElement && el.matches(':focus-visible')) {
      card.show(targetIn(el), FOCUS_MS);
    }
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') card.hide();
  };
  const doc = document;
  doc.addEventListener('pointermove', onMove);
  doc.addEventListener('pointerover', onOver);
  doc.addEventListener('pointerout', onOut);
  doc.addEventListener('focusin', onFocus);
  doc.addEventListener('focusout', card.hide);
  doc.addEventListener('click', card.hide);
  doc.addEventListener('keydown', onKey);
  doc.addEventListener('scroll', card.hide, { capture: true, passive: true });
  return () => {
    card.hide();
    doc.removeEventListener('pointermove', onMove);
    doc.removeEventListener('pointerover', onOver);
    doc.removeEventListener('pointerout', onOut);
    doc.removeEventListener('focusin', onFocus);
    doc.removeEventListener('focusout', card.hide);
    doc.removeEventListener('click', card.hide);
    doc.removeEventListener('keydown', onKey);
    doc.removeEventListener('scroll', card.hide, { capture: true });
  };
}

export function useHoverTarget(): HTMLElement | null {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => watch(setTarget), []);
  return target;
}
