import { type RefCallback, type SyntheticEvent, useCallback, useState } from 'react';

import { sameShape } from '@/application/plan-viz-screens';

const sizeOf = (img: HTMLImageElement | null) =>
  img === null ? null : { width: img.naturalWidth, height: img.naturalHeight };

/** Both pictures have loaded and are the same shape. */
function shapesMatch(root: HTMLElement): boolean {
  const today = sizeOf(root.querySelector<HTMLImageElement>('[data-today] img'));
  const plan = sizeOf(root.querySelector<HTMLImageElement>('[data-plan] img'));
  return today !== null && plan !== null && sameShape(today, plan);
}

interface SameShape {
  /** Put on the element holding both pictures; looks once it is in, in case they came in before the page woke. */
  readonly ref: RefCallback<HTMLElement>;
  /** Put on the same element: looks again each time a picture loads. */
  readonly onLoadCapture: (event: SyntheticEvent<HTMLElement>) => void;
  readonly same: boolean;
}

// Whether two pictures can be compared by swiping one over the other: a swipe over two different shapes would mislead.
export function useSameShape(): SameShape {
  const [same, setSame] = useState(false);
  const ref = useCallback<RefCallback<HTMLElement>>((root) => {
    if (root !== null) setSame(shapesMatch(root));
  }, []);
  const onLoadCapture = useCallback((event: SyntheticEvent<HTMLElement>) => {
    setSame(shapesMatch(event.currentTarget));
  }, []);
  return { ref, onLoadCapture, same };
}
