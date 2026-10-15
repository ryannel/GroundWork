import { type RefObject, useEffect } from 'react';

/** Scrolls the list so the item marked current is in view; a list with none is left alone. */
export function useScrollCurrent(list: RefObject<HTMLElement | null>, place: string): void {
  useEffect(() => {
    const box = list.current;
    const item = box?.querySelector<HTMLElement>('[aria-current="step"]');
    if (box === null || item === null || item === undefined) return;
    const over = item.offsetTop + item.offsetHeight - (box.scrollTop + box.clientHeight);
    const top = Math.min(item.offsetTop, box.scrollTop + Math.max(over, 0));
    box.scrollTo({ top });
  }, [list, place]);
}
