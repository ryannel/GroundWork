// A domain's language lives in domains/<domain>/language.yaml. A word belongs to the domain where it is born:
// the domain of the system whose component mints its id.

import type { Workspace } from '@/domain/workspace';
import type { DomainLanguage, WorkspaceModel } from '@/domain/workspace-model';

/** The domain each component sits in, by component id. */
function domainsByComponent(workspace: Workspace): Map<string, string> {
  const where = new Map<string, string>();
  for (const domain of workspace.domains)
    for (const system of domain.systems)
      for (const component of system.components) where.set(component.id, domain.id);
  return where;
}

/** Words written into one domain's language but born in another's. */
export function languageWarnings(workspace: Workspace, model: WorkspaceModel): string[] {
  const where = domainsByComponent(workspace);
  return model.languages.flatMap(({ domain, concepts }) =>
    concepts.flatMap((concept) => {
      const home = concept.born_in === undefined ? undefined : where.get(concept.born_in);
      if (home === undefined || home === domain) return [];
      return [
        `${concept.id} is born in ${String(concept.born_in)}, in ${home}; write it in domains/${home}/language.yaml, not ${domain}'s`,
      ];
    }),
  );
}

export interface DomainWords {
  /** The domain told in its own words; empty when its language.yaml has none. */
  readonly summary: string;
  /** The ids of the words the domain owns, as written. */
  readonly concepts: readonly string[];
}

/** The words one domain owns; null when it has written none down. */
export function domainWordsOf(
  languages: readonly DomainLanguage[],
  domain: string,
): DomainWords | null {
  const language = languages.find((each) => each.domain === domain);
  if (language === undefined || language.concepts.length === 0) return null;
  return { summary: language.summary ?? '', concepts: language.concepts.map((c) => c.id) };
}
