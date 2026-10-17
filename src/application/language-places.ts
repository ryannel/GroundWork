// Where a word lives in the systems: the domain and system of the component that mints it, or the system or
// domain a key term is anchored to. Ids are as they are written: con:… for a scanned word, sys:… and dom:… for
// a system or a domain, svc:… (or any component id) for a component.

import { domainHref, systemHref } from '@/application/workspace-paths';
import type { Concept } from '@/domain/plan/plan.generated';
import type { Workspace } from '@/domain/workspace';
import type { DomainLanguage } from '@/domain/workspace-model';

export interface Place {
  readonly id: string;
  readonly name: string;
  readonly href: string;
}

/** A domain, the system in it and the component, as far as an id says. */
export interface Where {
  readonly domain: Place | null;
  readonly system: Place | null;
  readonly component: string | null;
}

export interface Places {
  /** Where a component, system or domain id lives; null when the workspace has no such thing. */
  readonly of: (id: string) => Where | null;
  /** Each scanned word by id, with the domain whose language.yaml holds it. */
  readonly words: ReadonlyMap<string, { readonly concept: Concept; readonly domain: string }>;
}

const NOWHERE: Where = { domain: null, system: null, component: null };

function index(workspace: Workspace): Map<string, Where> {
  const at = new Map<string, Where>();
  for (const domain of workspace.domains) {
    const home = { id: domain.id, name: domain.name, href: domainHref(workspace.id, domain.id) };
    at.set(`dom:${domain.id}`, { ...NOWHERE, domain: home });
    for (const system of domain.systems) {
      const href = systemHref({ workspace: workspace.id, domain: domain.id, system: system.id });
      const place = {
        domain: home,
        system: { id: system.id, name: system.name, href },
        component: null,
      };
      at.set(`sys:${system.id}`, place);
      for (const component of system.components) {
        at.set(component.id, { ...place, component: component.name });
      }
    }
  }
  return at;
}

/** Where everything in a workspace lives, to look up by id. */
export function placesOf(workspace: Workspace, languages: readonly DomainLanguage[]): Places {
  const at = index(workspace);
  const words = new Map(
    languages.flatMap(({ domain, concepts }) =>
      concepts.map((c) => [c.id, { concept: c, domain }] as const),
    ),
  );
  const domainOf = (id: string): Where | null => at.get(`dom:${id}`) ?? null;
  const of = (id: string): Where | null => {
    const word = words.get(id);
    if (word === undefined) return at.get(id) ?? null;
    const born = word.concept.born_in === undefined ? undefined : at.get(word.concept.born_in);
    return born ?? domainOf(word.domain);
  };
  return { of, words };
}
