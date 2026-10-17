// A domain's language lives in domains/<domain>/language.yaml. A word belongs to the domain where it is born:
// the domain of the system whose component mints its id.

import { domainHref } from '@/application/workspace-paths';
import type { Workspace } from '@/domain/workspace';
import type { DomainLanguage, WorkspaceModel } from '@/domain/workspace-model';

/** The domain each component sits in, by component id. */
function domainsByComponent(workspace: Workspace): Map<string, string> {
  const where = new Map<string, string>();
  for (const domain of workspace.domains) {
    for (const system of domain.systems) {
      for (const component of system.components) where.set(component.id, domain.id);
    }
  }
  return where;
}

/** Key terms anchored to a word, system or domain the workspace does not have. */
function anchorWarnings(workspace: Workspace, model: WorkspaceModel): string[] {
  const known = new Set([
    ...model.languages.flatMap(({ concepts }) => concepts.map((c) => c.id)),
    ...workspace.domains.flatMap((d) => [`dom:${d.id}`, ...d.systems.map((s) => `sys:${s.id}`)]),
    ...domainsByComponent(workspace).keys(),
  ]);
  const terms = new Set(model.keyTerms.terms.map((t) => t.id));
  return model.keyTerms.terms.flatMap((term) => [
    ...term.anchors
      .filter((a) => !known.has(a.to))
      .map(
        (a) => `${term.id} is anchored to ${a.to}, which no language.yaml, system or domain has`,
      ),
    ...term.relates
      .filter((r) => !terms.has(r.to))
      .map((r) => `${term.id} relates to ${r.to}, which is not a key term in language.yaml`),
  ]);
}

/** Words written into one domain's language but born in another's, and key terms anchored to nothing. */
export function languageWarnings(workspace: Workspace, model: WorkspaceModel): string[] {
  const where = domainsByComponent(workspace);
  const misplaced = model.languages.flatMap(({ domain, concepts }) =>
    concepts.flatMap((concept) => {
      const home = concept.born_in === undefined ? undefined : where.get(concept.born_in);
      if (home === undefined || home === domain) return [];
      return [
        `${concept.id} is born in ${String(concept.born_in)}, in ${home}; write it in domains/${home}/language.yaml, not ${domain}'s`,
      ];
    }),
  );
  return [...misplaced, ...anchorWarnings(workspace, model)];
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

export interface DomainSpeech {
  readonly id: string;
  readonly name: string;
  readonly href: string;
  readonly words: DomainWords;
}

/** Every domain that has written its words down, in the workspace's order. */
export function workspaceWordsOf(
  workspace: Workspace,
  languages: readonly DomainLanguage[],
): DomainSpeech[] {
  return workspace.domains.flatMap((domain) => {
    const words = domainWordsOf(languages, domain.id);
    return words === null
      ? []
      : [{ id: domain.id, name: domain.name, href: domainHref(workspace.id, domain.id), words }];
  });
}
