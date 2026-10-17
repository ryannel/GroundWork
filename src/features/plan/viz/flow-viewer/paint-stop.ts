import { seqWalk, walker } from '@/application/plan-viz-flow-drawn';

const stepsOf = (list: string | undefined): number[] =>
  (list ?? '')
    .split(' ')
    .filter((s) => s !== '')
    .map(Number);

/**
 * Lights one stop on a drawing made once for every stop: each arrow, label and row says which steps it carries, and
 * its walk is worked out here, so the page holds one drawing rather than one for each stop.
 */
export function paintStop(root: ParentNode, indices: readonly number[]): void {
  const shown = new Set(indices);
  const walk = walker(shown);
  for (const el of root.querySelectorAll<HTMLElement | SVGElement>('[data-walk-steps]')) {
    el.dataset.walk = walk.loudest(stepsOf(el.dataset.walkSteps));
  }
  for (const el of root.querySelectorAll<HTMLElement | SVGElement>('[data-touch-steps]')) {
    el.dataset.touched = String(stepsOf(el.dataset.touchSteps).some((i) => shown.has(i)));
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-walk-at]')) {
    const w = seqWalk(Number(el.dataset.walkAt), shown);
    if (w === '') delete el.dataset.walk;
    else el.dataset.walk = w;
  }
  for (const el of root.querySelectorAll<HTMLElement>('[data-frame]')) {
    el.toggleAttribute('data-current', el.querySelector('[data-walk="current"]') !== null);
  }
}
