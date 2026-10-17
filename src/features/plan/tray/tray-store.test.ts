// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addPins,
  clearPins,
  markSeen,
  pinsOf,
  planOfPath,
  setTrayOpen,
  subscribe,
  trayOpen,
} from './tray-store';

let n = 0;
const fresh = (): string => {
  n += 1;
  return `acme/plan-${String(n)}`;
};

afterEach(() => {
  setTrayOpen(false);
  localStorage.clear();
});

describe('the plan a path is in', () => {
  it('reads the workspace and plan from a screen of the story', () => {
    expect(planOfPath('/acme/plans/shop/journey/browse/')).toBe('acme/shop');
    expect(planOfPath('/acme/plans/shop/')).toBe('acme/shop');
  });

  it('is null off a plan', () => {
    expect(planOfPath('/')).toBeNull();
    expect(planOfPath('/acme/')).toBeNull();
    expect(planOfPath('/acme/systems/catalogue/')).toBeNull();
    expect(planOfPath('/acme/plans/')).toBeNull();
  });
});

describe('pins', () => {
  it('pins each thing once, keeping where it was first met, and keeps them in the browser', () => {
    const plan = fresh();
    addPins(plan, ['a', 'b', 'a', ''], '/one/');
    addPins(plan, ['b', 'c'], '/two/');
    expect(pinsOf(plan)).toEqual([
      { id: 'a', from: '/one/', seen: false },
      { id: 'b', from: '/one/', seen: false },
      { id: 'c', from: '/two/', seen: false },
    ]);
    expect(JSON.parse(localStorage.getItem(`groundwork:ahead:${plan}`) ?? '[]')).toHaveLength(3);
  });

  it('reads pins kept before, and ignores what is not a pin', () => {
    const plan = fresh();
    localStorage.setItem(
      `groundwork:ahead:${plan}`,
      JSON.stringify([{ id: 'x', from: '/', seen: true }, { id: 3 }, 'junk']),
    );
    expect(pinsOf(plan)).toEqual([{ id: 'x', from: '/', seen: true }]);
  });

  it('survives storage that is broken', () => {
    const plan = fresh();
    localStorage.setItem(`groundwork:ahead:${plan}`, '{not json');
    expect(pinsOf(plan)).toEqual([]);
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full');
    });
    addPins(plan, ['a'], '/');
    expect(pinsOf(plan)).toHaveLength(1);
    set.mockRestore();
  });

  it('ticks off the pins seen, telling listeners only when something changed', () => {
    const plan = fresh();
    addPins(plan, ['a', 'b'], '/');
    const heard = vi.fn<() => void>();
    const stop = subscribe(heard);
    markSeen(plan, (p) => p.id === 'a');
    markSeen(plan, (p) => p.id === 'a');
    expect(heard).toHaveBeenCalledOnce();
    expect(pinsOf(plan).map((p) => p.seen)).toEqual([true, false]);
    stop();
  });

  it('clears a plan, and leaves nothing behind', () => {
    const plan = fresh();
    addPins(plan, ['a'], '/');
    clearPins(plan);
    expect(pinsOf(plan)).toEqual([]);
    expect(localStorage.getItem(`groundwork:ahead:${plan}`)).toBeNull();
  });
});

describe('the tray', () => {
  it('opens and closes', () => {
    const heard = vi.fn<() => void>();
    const stop = subscribe(heard);
    setTrayOpen(true);
    setTrayOpen(true);
    expect(trayOpen()).toBe(true);
    setTrayOpen(false);
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
  });
});
