import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

import { factsIn, findings, locate } from './sources';

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
