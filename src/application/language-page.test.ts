import { describe, expect, it } from 'vitest';

import { withStrayTerm } from '@/../test/fixtures/workspace-language';
import { acme } from '@/../test/workspace-kit';

import { languagePageOf } from './language-page';

function page(model = acme().model) {
  const { workspace } = acme();
  return languagePageOf(workspace, model.languages, model.keyTerms);
}

describe('languagePageOf', () => {
  it('lists the key terms in their groups, with the closest fit in the code and the first sentence of what each means', () => {
    const { groups, summary, source } = page();
    expect(summary).toBe('The words Acme agrees on.');
    expect(source).toStrictEqual({ title: 'Acme glossary', url: null, status: 'agreed' });
    expect(groups).toStrictEqual([
      {
        id: 'selling',
        name: 'Selling',
        terms: [
          {
            id: 'term:order',
            kind: 'key',
            name: 'Order',
            gist: 'Everything a customer buys at one checkout.',
            aliases: ['purchase'],
            domains: ['orders'],
            fit: 'same',
            text: 'order purchase purchase everything a customer buys at one checkout.',
          },
        ],
      },
    ]);
  });

  it('opens a key term onto where it lives, what the code calls it there, and the word it anchors to', () => {
    const order = page().details['term:order'];
    expect(order?.group).toBe('Selling');
    expect(
      order?.places.map((p) => [p.where.domain?.id, p.where.system?.id, p.word?.id, p.fit]),
    ).toStrictEqual([
      ['orders', 'ordering', 'con:order', 'same'],
      ['orders', 'ordering', undefined, 'lives-in'],
    ]);
    expect(order?.names.map((n) => [n.as, n.at])).toStrictEqual([['Purchase', 'sch:order']]);
  });

  it('lists every scanned word by name, and opens each onto the key terms anchored to it', () => {
    const { words, details } = page();
    expect(words.map((w) => w.name)).toStrictEqual(['Order', 'Order line', 'Payment']);
    expect(words.every((w) => w.kind === 'word' && w.fit === null)).toBe(true);
    expect(details['con:order']?.keyTerms).toStrictEqual([
      { id: 'term:order', name: 'Order', as: 'same' },
    ]);
    expect(details['con:order']?.relates).toStrictEqual([
      { id: 'con:payment', name: 'Payment', as: 'is settled by' },
    ]);
  });

  it('keeps a relation or anchor that misses as plain text, with nowhere to open', () => {
    const { model } = acme();
    const refund = page(withStrayTerm(model)).details['term:refund'];
    expect(refund?.relates).toStrictEqual([
      { id: 'term:order', name: 'Order', as: 'undoes' },
      { id: null, name: 'term:chargeback', as: 'is not' },
    ]);
    expect(
      refund?.places.filter((p) => p.where.domain === null && p.where.system === null),
    ).toHaveLength(2);
  });

  it('labels every term and word by name, so a citation reads as a word', () => {
    expect(page().labels).toStrictEqual({
      'term:order': 'Order',
      'con:order': 'Order',
      'con:order-line': 'Order line',
      'con:payment': 'Payment',
    });
  });
});
