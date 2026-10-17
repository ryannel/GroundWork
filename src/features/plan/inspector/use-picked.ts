import { useEffect } from 'react';

/** Marks every mention of the open thing on the page, outside the inspector, so the reader sees where it sits. */
export function usePicked(id: string | null): void {
  useEffect((): (() => void) | undefined => {
    if (id === null) return;
    const marked = [...document.querySelectorAll(`[data-inspect="${CSS.escape(id)}"]`)].filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement && el.closest('[data-inspector]') === null,
    );
    for (const el of marked) el.dataset.picked = '';
    return () => {
      for (const el of marked) delete el.dataset.picked;
    };
  }, [id]);
}
