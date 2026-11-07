import { languagePageFrom, type LanguagePage } from '@/application/language-page';
import type { Places, Where } from '@/application/language-places';
import type { ModelIndex } from '@/application/model-index';
import { localId } from '@/domain/ids';
import type { KeyTerms } from '@/domain/workspace-model';

function termsOf(index: ModelIndex): KeyTerms {
  const language = index.model.language;
  const source = language?.source;
  return {
    summary: language?.summary ?? null,
    source:
      source === undefined
        ? null
        : { title: source.title, url: source.url ?? null, status: source.status ?? null },
    groups: language?.groups ?? [],
    terms: (language?.terms ?? []).map((term) => ({
      ...term,
      group: term.group ?? null,
      aliases: term.aliases ?? [],
      examples: (term.examples ?? []).map((example) => ({
        ...example,
        analogy: example.analogy ?? null,
        sentence: example.sentence ?? null,
      })),
      relates: term.relates ?? [],
      anchors: (term.anchors ?? []).map((anchor) => ({ ...anchor, note: anchor.note ?? null })),
    })),
  };
}
function namedPlace(index: ModelIndex, id: string | null | undefined) {
  const node = id === null || id === undefined ? null : index.get(id);
  return node === null
    ? null
    : { id: node.id, name: index.label(node.id), href: index.href(node.id) };
}
function placesOf(index: ModelIndex): Places {
  const words: Places['words'] = new Map(
    index.model.domains.flatMap((domain) =>
      (domain.language?.concepts ?? []).map(
        (concept) =>
          [
            concept.id,
            {
              concept: { ...concept, means: concept.means ?? 'Meaning not recorded.' },
              domain: domain.id,
            },
          ] as const,
      ),
    ),
  );
  const of = (id: string): Where | null => {
    const word = words.get(id);
    const node = index.get(id);
    if (node === null && word === undefined) return null;
    const origin = word?.concept.born_in;
    const at = (origin === undefined ? null : index.place(origin)) ??
      node?.place ?? { domain: word?.domain ?? null, system: null, component: null };
    return {
      domain: namedPlace(index, at.domain),
      system: namedPlace(index, at.system),
      component: at.component === null ? null : index.label(at.component),
    };
  };
  return { words, of };
}
/** A bounded directory projection; explicit origins use canonical containment, independently of ownership. */
export function modelLanguageOf(index: ModelIndex): LanguagePage {
  const keyTerms = termsOf(index);
  const places = placesOf(index);
  const names = new Map([
    ...keyTerms.terms.map((term) => [term.id, term.name] as const),
    ...[...places.words.values()].map(({ concept }) => [concept.id, concept.name] as const),
  ]);
  return languagePageFrom(
    {
      places,
      keyTerms,
      nameOf: (id) => names.get(id) ?? null,
      label: (id) => names.get(id) ?? (index.get(id) === null ? localId(id) : index.label(id)),
    },
    index.model.domains.map((domain) => ({
      id: domain.id,
      name: domain.name,
      href: index.href(domain.id),
    })),
  );
}
