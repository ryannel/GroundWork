import { describe, expect, it } from 'vitest';

import { inlineText, parseInline, parseMarkdown, shortUrl } from './markdown';

const kinds = (text: string) => parseInline(text).map((run) => run.kind);

describe('parseInline', () => {
  it('finds citations, code, emphasis and links', () => {
    expect(
      kinds('See [[svc:orders]], `code`, **bold**, *em* and [docs](https://x.org/a).'),
    ).toEqual([
      'text',
      'ref',
      'text',
      'code',
      'text',
      'strong',
      'text',
      'em',
      'text',
      'link',
      'text',
    ]);
  });

  it('shortens a bare URL and leaves its trailing stop outside', () => {
    const runs = parseInline('Read https://github.com/a/b/blob/main/x.go. Then (https://y.org)');
    expect(runs[1]).toMatchObject({
      kind: 'link',
      href: 'https://github.com/a/b/blob/main/x.go',
      short: true,
    });
    expect(runs[3]).toMatchObject({ kind: 'link', href: 'https://y.org', text: 'y.org' });
  });

  it('leaves what is not markup as text', () => {
    expect(kinds('a [[not an id]] * b ** `` [x](ftp:y) [x] xhttp://z hello')).toEqual(['text']);
    expect(kinds('`open')).toEqual(['text']);
  });

  it('nests emphasis', () => {
    const [strong] = parseInline('**a `b`**');
    expect(strong?.kind === 'strong' ? strong.children.map((c) => c.kind) : []).toEqual([
      'text',
      'code',
    ]);
  });
});

describe('parseMarkdown', () => {
  it('splits paragraphs, lists and quotes', () => {
    const blocks = parseMarkdown('One\ntwo\n\n- a\n- b\n1. c\n> quoted\n> more\nafter\r\n');
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'list', 'list', 'quote', 'paragraph']);
    expect(blocks[1]).toMatchObject({ ordered: false, items: [{ key: '0' }, { key: '1' }] });
    expect(blocks[2]).toMatchObject({ ordered: true });
    expect(blocks[3]?.kind === 'quote' ? inlineText(blocks[3].inlines, String) : '').toBe(
      'quoted more',
    );
  });

  it('is empty for no text', () => {
    expect(parseMarkdown(null)).toEqual([]);
    expect(parseMarkdown('')).toEqual([]);
  });
});

describe('shortUrl', () => {
  it('keeps the host and the last part', () => {
    expect(shortUrl('https://www.example.com/')).toBe('example.com');
    expect(shortUrl('https://example.com')).toBe('example.com');
    expect(shortUrl(`https://e.com/a/${'x'.repeat(50)}`)).toBe(`e.com/…/${'x'.repeat(39)}…`);
  });
});

describe('inlineText', () => {
  it('writes every run as words', () => {
    expect(
      inlineText(parseInline('**a** [[svc:x]] [t](https://u.v) https://w.x'), (id) =>
        id.toUpperCase(),
      ),
    ).toBe('a SVC:X t https://w.x');
  });
});
