import { type RefObject, useEffect } from 'react';

interface StepClicks {
  /** Called with the stop (0-based) a click on a `data-step` button asks for. */
  readonly onGo: (stop: number) => void;
  /** Called with -1 or 1 for the arrow keys; the keys are left alone without it. */
  readonly onMove?: ((by: -1 | 1) => void) | undefined;
}

const chorded = (e: KeyboardEvent): boolean => e.altKey || e.ctrlKey || e.metaKey;

const typing = (el: EventTarget | null): boolean =>
  el instanceof HTMLElement &&
  (el.isContentEditable || /^(?:input|textarea|select)$/iu.test(el.tagName));

/**
 * Lets every `data-step` button inside the box take the viewer to that stop, and the arrow keys step through them.
 * A click on something that opens the inspector, or on a pin, is left to its own handler.
 */
export function useStepClicks(
  box: RefObject<HTMLElement | null>,
  { onGo, onMove }: StepClicks,
): void {
  useEffect((): (() => void) | undefined => {
    const el = box.current;
    if (el === null) return;
    const click = (e: MouseEvent): void => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest('[data-inspect],[data-pin]') !== null) return;
      const go = e.target.closest<HTMLElement>('[data-step]');
      const stop = Number(go?.dataset.step);
      if (go !== null && Number.isInteger(stop) && stop > 0) onGo(stop - 1);
    };
    const key = (e: KeyboardEvent): void => {
      if (onMove === undefined || typing(e.target) || chorded(e)) return;
      if (e.key === 'ArrowLeft') onMove(-1);
      if (e.key === 'ArrowRight') onMove(1);
    };
    el.addEventListener('click', click);
    el.addEventListener('keydown', key);
    return () => {
      el.removeEventListener('click', click);
      el.removeEventListener('keydown', key);
    };
  }, [box, onGo, onMove]);
}
