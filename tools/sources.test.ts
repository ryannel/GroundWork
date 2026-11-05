import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { factsIn, findings, isAttributed, locate } from './sources';

const COMMIT = '3f9c2e1a3f9c2e1a3f9c2e1a3f9c2e1a3f9c2e1a';
const SOURCE = { repo: 'acme/pricing', path: 'src/price.ts', lines: [3, 9], commit: COMMIT };

describe('locate', () => {
  it('accepts a source pinned to a commit', () => {
    expect(locate(SOURCE)).toEqual(SOURCE);
  });

  it('drops a github.com prefix so repos read as system.yaml lists them', () => {
    expect(locate({ ...SOURCE, repo: 'github.com/acme/pricing' })).toHaveProperty(
      'repo',
      'acme/pricing',
    );
  });

  it('reads the older url form', () => {
    expect(
      locate({ url: `https://github.com/acme/pricing/blob/${COMMIT}/src/price.ts#L3-L9` }),
    ).toEqual(SOURCE);
  });

  it('decodes the path of a url, so a file named [id] is found', () => {
    const url = `https://github.com/acme/pricing/blob/${COMMIT}/app/%5Bid%5D/page.tsx#L1`;
    expect(locate({ url })).toHaveProperty('path', 'app/[id]/page.tsx');
  });

  it('refuses a branch where a commit belongs', () => {
    expect(locate({ ...SOURCE, commit: 'main' })).toEqual({
      problem: 'acme/pricing src/price.ts: commit must be a full 40-character sha',
    });
  });

  it('notes, without refusing, a source that cites no lines', () => {
    const [fact] = factsIn(
      { id: 'svc:pricing', sources: [{ repo: 'a/b', path: 'main.kt', commit: COMMIT }] },
      'domains/d/systems/s/contracts.yaml',
    );
    expect(fact?.sources).toHaveLength(1);
    expect(fact === undefined ? [] : findings(fact).warnings).toEqual([
      'svc:pricing: main.kt: cite the lines you read, or [1, <length>] for a whole file',
    ]);
  });

  it('refuses lines that run backwards', () => {
    expect(locate({ ...SOURCE, lines: [9, 3] })).toEqual({
      problem: 'lines must be [from, to], counted from 1',
    });
  });
});

describe('factsIn', () => {
  const doc = {
    components: [
      { id: 'pricing-api', sources: [SOURCE], interfaces: [{ id: 'api:pricing-get-price' }] },
      { id: 'demo', origin: 'seeded' },
    ],
  };

  it('treats every object with an id as a fact, extracted by default in contracts.yaml', () => {
    const facts = factsIn(doc, 'domains/d/systems/s/contracts.yaml');
    expect(facts.map((fact) => [fact.id, fact.origin, fact.sources.length])).toEqual([
      ['pricing-api', 'extracted', 1],
      ['api:pricing-get-price', 'extracted', 0],
      ['demo', 'seeded', 0],
    ]);
  });

  it('reports an extracted fact without sources as an error, a seeded one not at all', () => {
    const facts = factsIn(doc, 'domains/d/systems/s/contracts.yaml');
    expect(facts.flatMap((fact) => findings(fact).errors)).toEqual([
      'api:pricing-get-price: extracted but cites no code; add sources with tools/permalink.ts',
    ]);
  });

  it('treats facts in curated files as curated', () => {
    expect(factsIn({ id: 'checkout' }, 'flows/checkout.yaml')[0]?.origin).toBe('curated');
  });

  it('warns about handler steps that call out or decide without citing code', () => {
    const handlers: unknown = parse(`
      handlers:
        - id: h:pricing-get-price
          sources: [{ repo: a/b, path: x.ts, lines: [1, 9], commit: ${COMMIT} }]
          steps:
            - { call: api:stock-get, sources: [{ repo: a/b, path: x.ts, lines: [4, 6], commit: ${COMMIT} }] }
            - { if: no price, then: [{ fail: not found }] }
    `);
    const [fact] = factsIn(handlers, 'domains/d/systems/s/handlers.yaml');
    expect(fact?.stepsWithoutSources).toBe(1);
    expect(fact?.sources).toHaveLength(2);
  });
});

describe('documented facts', () => {
  const file = 'domains/d/systems/ziklo/contracts.yaml';
  const document = {
    url: 'https://www.notion.so/ziklo/order-api',
    heading: 'Change an order',
    version: '2026-10',
  };

  it('counts a document as the source of a documented fact, not as a broken code link', () => {
    const [fact] = factsIn(
      { id: 'api:ziklo-quote', origin: 'documented', sources: [document] },
      file,
    );
    expect(fact?.documents).toEqual([document]);
    expect(fact?.problems).toEqual([]);
    expect(fact === undefined ? false : isAttributed(fact)).toBe(true);
    expect(fact === undefined ? [] : findings(fact).errors).toEqual([]);
  });

  it('reads a link that names where in a document it points as a document, whatever the origin', () => {
    const [fact] = factsIn(
      { id: 'if:ziklo', origin: 'curated', sources: [{ url: document.url, pointer: '#/paths' }] },
      file,
    );
    expect(fact?.documents).toEqual([{ url: document.url, pointer: '#/paths' }]);
  });

  it('keeps a code permalink a documented fact cites as code', () => {
    const url = `https://github.com/acme/pricing/blob/${COMMIT}/src/price.ts#L3-L9`;
    const [fact] = factsIn({ id: 'api:x', origin: 'documented', sources: [{ url }] }, file);
    expect(fact?.sources).toEqual([SOURCE]);
    expect(fact?.documents).toEqual([]);
  });

  it('reports a documented fact that cites nothing, and leaves it unattributed', () => {
    const [fact] = factsIn({ id: 'api:ziklo-quote', origin: 'documented' }, file);
    expect(fact === undefined ? true : isAttributed(fact)).toBe(false);
    expect(fact === undefined ? [] : findings(fact).errors).toEqual([
      'api:ziklo-quote: documented but cites no document; add { url, pointer or heading, version }',
    ]);
  });
});
