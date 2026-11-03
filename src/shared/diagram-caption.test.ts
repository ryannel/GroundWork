import { describe, expect, it } from 'vitest';

import { diagramCaption } from './diagram-caption';

describe('connection captions', () => {
  it('keeps an action and its object in two short lines, rather than slicing through a word', () => {
    expect(diagramCaption('Read and refresh complete product views').lines).toEqual([
      'Read & refresh complete',
      'product views',
    ]);
  });

  it('bounds long explanations while preserving the original input', () => {
    const original =
      'Read eligible product and package details for a particular market and customer';
    const caption = diagramCaption(original);
    expect(caption.lines).toHaveLength(2);
    expect(caption.lines[1]).toMatch(/…$/u);
    expect(original).toContain('particular market and customer');
    expect(caption.height).toBe(caption.lineHeight * 2 + 2);
  });

  it('keeps technical operations concise and gives wide letters more room', () => {
    expect(diagramCaption('GET /v1/markets/{market}/products?include=all').lines).toEqual([
      'GET products',
    ]);
    expect(diagramCaption('WWW').width).toBeGreaterThan(diagramCaption('iii').width);
  });
});
