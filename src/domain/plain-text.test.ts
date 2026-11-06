import { describe, expect, it } from 'vitest';

import { clip, plain, plainTitle } from './plain-text';

const label = (id: string) => (id === 'svc:a' ? 'Orders' : `Unknown ${id}`);
describe('model prose', () => {
  it('uses the shared identity grammar in blocks, inline titles and clipped summaries', () => {
    expect(plain('# Heading\n**Read** [[svc:a]]\n\n- [[unknown:x]]\n- `code`', label)).toBe(
      'Heading Read Orders Unknown unknown:x code',
    );
    expect(plainTitle('*Read* [[svc:a]] [docs](https://example.com)', label)).toBe(
      'Read Orders docs',
    );
    expect(clip('**Read** [[svc:a]]', label, 8)).toBe('Read Or…');
    expect(clip('Short', label)).toBe('Short');
    expect(plain(null, label)).toBe('');
    expect(plainTitle(undefined, label)).toBe('');
  });
  it('keeps malformed or unsupported legacy references as literal visible text', () => {
    expect(plain('[[not an id]] [[h:x#tx/read]] [[sch:Order#item_id]]', label)).toBe(
      '[[not an id]] [[h:x#tx/read]] Unknown sch:Order#item_id',
    );
  });
});
