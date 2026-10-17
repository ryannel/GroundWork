import { describe, expect, it } from 'vitest';

import { acmeSpeaking, withStrayTerm } from '@/../test/fixtures/workspace-language';

import { domainWordsOf, languageWarnings, workspaceWordsOf } from './workspace-language';
import { systemModelOf } from './workspace-model';

const { workspace, model } = acmeSpeaking();

describe('a domain language', () => {
  it('is read per domain and joins today', () => {
    expect(model.languages.map(({ domain }) => domain)).toEqual(['catalogue', 'orders']);
    const words = systemModelOf(workspace, model).plan.domain?.concepts?.map(({ id }) => id);
    expect(words).toContain('con:sku');
    expect(words).toContain('con:order');
  });

  it('keeps each word in the domain where it is born', () => {
    expect(languageWarnings(workspace, model)).toEqual([]);
    const [first, ...rest] = model.languages;
    const moved = { ...model, languages: [{ ...first!, domain: 'storefront' }, ...rest] };
    expect(languageWarnings(workspace, moved)).toEqual([
      "con:sku is born in svc:products, in catalogue; write it in domains/catalogue/language.yaml, not storefront's",
    ]);
  });

  it('gives each domain only its own words, and nothing where none are written', () => {
    const words = domainWordsOf(model.languages, 'catalogue');
    expect(words).toEqual({
      summary: 'A **SKU** names one thing Acme sells.',
      concepts: ['con:sku'],
    });
    expect(domainWordsOf(model.languages, 'orders')?.concepts).not.toContain('con:sku');
    expect(domainWordsOf(model.languages, 'nowhere')).toBeNull();
    expect(workspaceWordsOf(workspace, model.languages).map(({ id, href }) => [id, href])).toEqual([
      ['catalogue', '/acme/catalogue/'],
      ['orders', '/acme/orders/'],
    ]);
  });
});

describe('key terms', () => {
  it('may be anchored to a word, a system, a domain or a component the workspace has', () => {
    expect(languageWarnings(workspace, model)).toEqual([]);
    const stray = withStrayTerm(model);
    const kept = stray.keyTerms.terms.map((term) => ({
      ...term,
      relates: term.relates.slice(0, 1),
      anchors: term.anchors.slice(0, 3),
    }));
    expect(kept.at(-1)?.anchors.map((a) => a.to)).toEqual([
      'con:payment',
      'dom:orders',
      'svc:payments',
    ]);
    expect(
      languageWarnings(workspace, { ...stray, keyTerms: { ...stray.keyTerms, terms: kept } }),
    ).toEqual([]);
  });

  it('warns of anchors to unknown ids and relations to words that are not key terms', () => {
    expect(languageWarnings(workspace, withStrayTerm(model))).toEqual([
      'term:refund is anchored to con:refund, which no language.yaml, system or domain has',
      'term:refund is anchored to sys:refunds, which no language.yaml, system or domain has',
      'term:refund relates to term:chargeback, which is not a key term in language.yaml',
    ]);
  });

  it('lists misplaced words before key terms anchored to nothing', () => {
    const [first, ...rest] = model.languages;
    const both = withStrayTerm({
      ...model,
      languages: [{ ...first!, domain: 'orders' }, ...rest],
    });
    const warnings = languageWarnings(workspace, both);
    expect(warnings).toHaveLength(4);
    expect(warnings[0]).toMatch(/^con:sku is born in svc:products, in catalogue;/u);
  });
});
