import type { Model } from '@/application/plan/derive';
import type { Workspace } from '@/domain/workspace';
import {
  type Attribution,
  type CodeSource,
  type Origin,
  permalinkOf,
} from '@/domain/workspace-model';

import { screenEntry, type PaletteEntry } from './plan-pages-search';
import { journeysHref, referenceHref } from './today-reader';
import { domainHref, systemHref, workspaceHref } from './workspace-paths';

// What a thing's page of today says beyond what the inspector does: where it sits in the workspace, and the
// code that says so.

export interface PlaceStep {
  readonly label: string;
  readonly href: string;
}

/** Domain › system › component, for a component, a system, or a thing a component holds. */
export interface TodayPlace {
  readonly domain: PlaceStep;
  readonly system: PlaceStep;
  /** The component that holds the thing; null when the thing is the system, or the component itself. */
  readonly component: { readonly id: string; readonly name: string } | null;
}

function holderOf(workspace: Workspace, component: string) {
  for (const domain of workspace.domains) {
    for (const system of domain.systems) {
      const found = system.components.find((c) => c.id === component);
      if (found !== undefined) return { domain, system, component: found };
    }
  }
  return null;
}

function systemPlace(workspace: Workspace, id: string): TodayPlace | null {
  for (const domain of workspace.domains) {
    const system = domain.systems.find((s) => `sys:${s.id}` === id);
    if (system !== undefined) return placeOf(workspace, { domain, system, component: null });
  }
  return null;
}

function placeOf(
  workspace: Workspace,
  at: {
    readonly domain: { readonly id: string; readonly name: string };
    readonly system: { readonly id: string; readonly name: string };
    readonly component: { readonly id: string; readonly name: string } | null;
  },
): TodayPlace {
  const here = { workspace: workspace.id, domain: at.domain.id, system: at.system.id };
  return {
    domain: { label: at.domain.name, href: domainHref(workspace.id, at.domain.id) },
    system: { label: at.system.name, href: systemHref(here) },
    component: at.component,
  };
}

/** Where a thing sits in the workspace, or null when no component holds it (a flow, a journey, a team). */
export function todayPlaceOf(workspace: Workspace, model: Model, id: string): TodayPlace | null {
  if (id.startsWith('sys:')) return systemPlace(workspace, id);
  const own = holderOf(workspace, id);
  if (own !== null) return placeOf(workspace, { ...own, component: null });
  const owner = model.ownerService(id);
  const held = owner === null ? null : holderOf(workspace, owner);
  return held === null
    ? null
    : placeOf(workspace, {
        ...held,
        component: { id: held.component.id, name: held.component.name },
      });
}

export interface Evidence {
  /** The thing itself, or a part of it (an endpoint of an interface, a field of a schema). */
  readonly about: string;
  readonly origin: Origin;
  readonly href: string;
  readonly repo: string;
  /** path:lines, as a reader finds it in the repo. */
  readonly where: string;
  /** The commit, shortened. */
  readonly commit: string;
  readonly symbol: string | null;
  readonly note: string | null;
}

const ORIGIN_WORDS: Readonly<Record<Origin, string>> = {
  extracted: 'Read from the code',
  seeded: 'Seeded for the demo',
  curated: 'Written by hand',
};

/** Who said a fact, in words. */
export const originWord = (origin: Origin): string => ORIGIN_WORDS[origin];

const whereOf = (source: CodeSource): string => {
  if (source.lines === undefined) return source.path;
  const [from, to] = source.lines;
  return from === to
    ? `${source.path}:${String(from)}`
    : `${source.path}:${String(from)}–${String(to)}`;
};

const ownFirst = (id: string, a: string, b: string): number => {
  if (a === id) return -1;
  if (b === id) return 1;
  return a.localeCompare(b);
};

/** The code behind a thing and its parts, each line with its permalink, the thing's own first. */
export function codeEvidenceOf(
  attribution: Readonly<Record<string, Attribution>>,
  id: string,
): Evidence[] {
  const ids = Object.keys(attribution).filter((key) => key === id || key.startsWith(`${id}#`));
  const seen = new Set<string>();
  return ids
    .toSorted((a, b) => ownFirst(id, a, b))
    .flatMap((about) => {
      const said = attribution[about];
      return (said?.sources ?? []).map((source) => ({ about, origin: said?.origin, source }));
    })
    .flatMap(({ about, origin, source }) => {
      const href = permalinkOf(source);
      if (origin === undefined || seen.has(href)) return [];
      seen.add(href);
      return [
        {
          about,
          origin,
          href,
          repo: source.repo,
          where: whereOf(source),
          commit: source.commit.slice(0, 7),
          symbol: source.symbol ?? null,
          note: source.note ?? null,
        },
      ];
    });
}

/** The pages of the workspace, for the palette before anything is typed. */
export function todayScreensOf(workspace: Workspace): PaletteEntry[] {
  return [
    screenEntry({ href: workspaceHref(workspace.id), title: 'Landscape', hint: workspace.name }),
    ...workspace.domains.flatMap((domain) => [
      screenEntry({
        href: domainHref(workspace.id, domain.id),
        title: domain.name,
        hint: 'Domain',
      }),
      ...domain.systems.map((system) =>
        screenEntry({
          href: systemHref({ workspace: workspace.id, domain: domain.id, system: system.id }),
          title: system.name,
          hint: `System in ${domain.name}`,
        }),
      ),
    ]),
    screenEntry({ href: journeysHref(workspace.id), title: 'Journeys', hint: workspace.name }),
    screenEntry({ href: referenceHref(workspace.id), title: 'Reference', hint: workspace.name }),
  ];
}
