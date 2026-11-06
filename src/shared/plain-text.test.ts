import { describe, expect, it } from 'vitest';

import {
  clip as genericClip,
  cutAtWord,
  plain as genericPlain,
  plainTitle as genericTitle,
} from './plain-text';

const isReference = (id: string) => id === 'svc:orders';
const plain = (text: string | null | undefined, label: (id: string) => string) =>
  genericPlain(text, label, isReference);
const plainTitle = (text: string | null | undefined, label: (id: string) => string) =>
  genericTitle(text, label, isReference);
const clip = (text: string, label: (id: string) => string, n?: number) =>
  genericClip(text, label, isReference, n);

const label = (id: string) => (id === 'svc:orders' ? 'Orders' : id);

describe('plain', () => {
  it('drops markdown and names citations', () => {
    expect(plain('# Head\n**Bold** to [[svc:orders]]\n\n- one\n- *two*\n> said', label)).toBe(
      'Head Bold to Orders one two said',
    );
    expect(plain(undefined, label)).toBe('');
  });
});

describe('plainTitle', () => {
  it('keeps a ">" and drops marks', () => {
    expect(plainTitle('A > `b`  [[svc:orders]] **c', label)).toBe('A > b Orders c');
    expect(plainTitle(null, label)).toBe('');
  });
});

describe('cutAtWord and clip', () => {
  it('cuts at a word break', () => {
    expect(cutAtWord('short', 10)).toBe('short');
    expect(cutAtWord('one two three, four', 16)).toBe('one two three…');
    expect(cutAtWord('abcdefghijklmnop', 8)).toBe('abcdefg…');
    expect(clip('**one** two three four', label, 12)).toBe('one two thr…');
    expect(clip('word', label)).toBe('word');
  });
});
