import { describe, expect, it } from 'vitest';

import { keyAction, type KeyPress } from './keys';

const press = (key: string, held: Partial<KeyPress> = {}): KeyPress => ({
  key,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  ...held,
});

describe('keyAction', () => {
  it('moves by screen on j, k and the arrows, and by chapter on J and K', () => {
    expect(keyAction(press('j'))).toBe('next');
    expect(keyAction(press('ArrowLeft'))).toBe('previous');
    expect(keyAction(press('J', { shiftKey: true }))).toBe('nextChapter');
    expect(keyAction(press('K', { shiftKey: true }))).toBe('previousChapter');
    expect(keyAction(press('ArrowRight', { shiftKey: true }))).toBeNull();
  });

  it('opens search, the plan switcher and the cheat sheet', () => {
    expect(keyAction(press('/'))).toBe('palette');
    expect(keyAction(press('k', { metaKey: true }))).toBe('palette');
    expect(keyAction(press('P', { metaKey: true, shiftKey: true }))).toBe('plans');
    expect(keyAction(press('p', { ctrlKey: true, shiftKey: true }))).toBe('plans');
    expect(keyAction(press('?', { shiftKey: true }))).toBe('cheat');
  });

  it('cycles the theme and the view, and leaves other keys and chords alone', () => {
    expect(keyAction(press('t'))).toBe('theme');
    expect(keyAction(press('D', { shiftKey: true }))).toBe('mode');
    expect(keyAction(press('t', { altKey: true }))).toBeNull();
    expect(keyAction(press('j', { metaKey: true }))).toBeNull();
    expect(keyAction(press('x'))).toBeNull();
  });
});
