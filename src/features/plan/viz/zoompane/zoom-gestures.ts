import { type PaneView, panned, wheelScale, zoomAbout } from '@/application/plan-viz-zoompane';

type Move = (view: PaneView) => void;
type Current = () => PaneView | null;

const DRAG_START = 5;

interface Drag {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly from: PaneView;
  readonly on: boolean;
}

function bindWheel(el: HTMLElement, current: Current, move: Move): () => void {
  const onWheel = (event: WheelEvent): void => {
    const view = current();
    if (view === null) return;
    event.preventDefault();
    const box = el.getBoundingClientRect();
    if (event.ctrlKey || event.metaKey) {
      const scale = wheelScale(view, event.deltaY, event.deltaMode !== 0);
      move(zoomAbout(view, scale, { x: event.clientX - box.left, y: event.clientY - box.top }));
    } else move(panned(view, view.x - event.deltaX, view.y - event.deltaY));
  };
  el.addEventListener('wheel', onWheel, { passive: false });
  return () => {
    el.removeEventListener('wheel', onWheel);
  };
}

/** Drag to pan; a drag never opens what it started on. */
function bindDrag(el: HTMLElement, current: Current, move: Move): () => void {
  let drag: Drag | null = null;
  let swallow = false;
  const onDown = (event: PointerEvent): void => {
    const from = current();
    if (event.button !== 0 || from === null) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, from, on: false };
  };
  const onMove = (event: PointerEvent): void => {
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.on && Math.hypot(dx, dy) < DRAG_START) return;
    drag = { ...drag, on: true };
    el.toggleAttribute('data-panning', true);
    move(panned(drag.from, drag.from.x + dx, drag.from.y + dy));
  };
  const onEnd = (): void => {
    swallow = drag?.on === true;
    drag = null;
    el.toggleAttribute('data-panning', false);
  };
  const onClick = (event: MouseEvent): void => {
    if (!swallow) return;
    event.stopPropagation();
    event.preventDefault();
    swallow = false;
  };
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onEnd);
  el.addEventListener('pointercancel', onEnd);
  el.addEventListener('click', onClick, true);
  return () => {
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', onEnd);
    el.removeEventListener('pointercancel', onEnd);
    el.removeEventListener('click', onClick, true);
  };
}

/** Wheel and drag over a panel: scroll pans, ctrl or ⌘ and scroll zooms, a drag pans. Returns the way to stop. */
export function bindGestures(el: HTMLElement, current: Current, move: Move): () => void {
  const stops = [bindWheel(el, current, move), bindDrag(el, current, move)];
  return () => {
    for (const stop of stops) stop();
  };
}
