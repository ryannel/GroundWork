// Acme speaking in two domains, and key terms that point at things Acme does not have.
import { acme, type Acme } from '@/../test/workspace-kit';
import { systemModelOf } from '@/application/workspace-model';
import type { DomainLanguage, KeyTerm, WorkspaceModel } from '@/domain/workspace-model';

/** The catalogue's words: a SKU, born in the Products API. */
function catalogueLanguage(): DomainLanguage {
  return {
    domain: 'catalogue',
    summary: 'A **SKU** names one thing Acme sells.',
    concepts: [
      {
        id: 'con:sku',
        name: 'SKU',
        terms: ['sku', 'stock code'],
        means: 'The code that names one product.',
        born_in: 'svc:products',
      },
    ],
  };
}

/** Acme with a language in the catalogue as well as in orders, in the order the store reads them: by folder. */
export function acmeSpeaking(): Acme {
  const { workspace, model } = acme();
  const speaking: WorkspaceModel = {
    ...model,
    languages: [catalogueLanguage(), ...model.languages],
  };
  return { workspace, model: speaking, today: systemModelOf(workspace, speaking) };
}

/** A key term whose anchors and relations miss: one word, system and term Acme lacks, beside ones it has. */
function strayTerm(): KeyTerm {
  return {
    id: 'term:refund',
    name: 'Refund',
    group: 'selling',
    aliases: [],
    means: 'Money given back for an order.',
    examples: [],
    relates: [
      { to: 'term:order', as: 'undoes' },
      { to: 'term:chargeback', as: 'is not' },
    ],
    anchors: [
      { to: 'con:payment', fit: 'close', note: null },
      { to: 'dom:orders', fit: 'lives-in', note: null },
      { to: 'svc:payments', fit: 'lives-in', note: null },
      { to: 'con:refund', fit: 'same', note: null },
      { to: 'sys:refunds', fit: 'lives-in', note: null },
    ],
  };
}

/** Acme's model with the stray key term added. */
export function withStrayTerm(model: WorkspaceModel): WorkspaceModel {
  return {
    ...model,
    keyTerms: { ...model.keyTerms, terms: [...model.keyTerms.terms, strayTerm()] },
  };
}
