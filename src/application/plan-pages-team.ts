import type { Model } from '@/application/plan/derive';
import type { Outline, Page } from '@/application/plan-pages';
import { type ChangeBody, changesLayout } from '@/application/plan-pages-screens-changes';
import { journeyGroups } from '@/application/plan-story-journey-groups';

// The pages a team lens keeps in the rail: those about something the team owns, changes, tests, builds or decides.
// The cover, the why, the reference and the versions stay for everyone; so does each chapter's opening screen,
// so no chapter goes empty.

export interface TeamPages {
  readonly id: string;
  readonly name: string;
  /** The addresses of the team's pages, in reading order. */
  readonly hrefs: readonly string[];
}

type Cut = ReturnType<Model['teamCut']>;

const ALWAYS = new Set(['cover', 'why', 'ref', 'versions']);
const JOURNEY_ALWAYS = new Set(['execution', 'behind']);
const any = (ids: readonly string[], cut: Cut): boolean => ids.some((id) => cut.has(id));

function changeIs(body: ChangeBody | undefined, cut: Cut): boolean {
  if (body === undefined) return true;
  switch (body.kind) {
    case 'flows':
    case 'screens':
    case 'records': {
      return any(body.ids, cut);
    }
    case 'small-flow': {
      return cut.has(body.id);
    }
    case 'graph':
    case 'contracts': {
      return cut.changes.length > 0;
    }
    case 'more': {
      return true;
    }
    case 'ledger': {
      return false;
    }
  }
}

interface Screens {
  readonly journey: ReadonlyMap<string, readonly string[]>;
  readonly changes: ReadonlyMap<string, ChangeBody>;
}

function commitIs(screen: string, cut: Cut): boolean {
  if (screen === 'risks') return cut.risks.length > 0;
  if (screen === 'ask') return true;
  return cut.decides.size + cut.decisions.length + cut.questions.length > 0;
}

function pageIs(page: Page, cut: Cut, screens: Screens): boolean {
  const { chapter, screen } = page;
  if (ALWAYS.has(chapter)) return true;
  if (chapter === 'journey') {
    return JOURNEY_ALWAYS.has(screen) || any(screens.journey.get(screen) ?? [], cut);
  }
  if (chapter === 'changes') return changeIs(screens.changes.get(screen), cut);
  if (chapter === 'prove') {
    return screen === 'coverage' ? cut.changes.length > 0 : cut.tests.length > 0;
  }
  if (chapter === 'build') return screen !== 'build-order' || cut.workItems.length > 0;
  return chapter === 'commit' && commitIs(screen, cut);
}

const known = new WeakMap<Outline, TeamPages[]>();

/** Each team's pages, in plan order of the teams; worked out once per outline, as every screen asks. */
export function teamPages(model: Model, outline: Outline): TeamPages[] {
  const kept = known.get(outline);
  if (kept !== undefined) return kept;
  const teams = cutPages(model, outline);
  known.set(outline, teams);
  return teams;
}

function cutPages(model: Model, outline: Outline): TeamPages[] {
  const screens: Screens = {
    journey: new Map(journeyGroups(model).map((g) => [g.key, g.flows])),
    changes: new Map(changesLayout(model).map((s) => [s.key, s.body])),
  };
  return model.plan.teams.map((team) => {
    const cut = model.teamCut(team.id);
    const kept = outline.pages.filter((page) => pageIs(page, cut, screens));
    const firsts = outline.chapters.flatMap((c) => {
      const first = outline.pages.find((p) => p.chapter === c.key);
      return first === undefined || kept.some((p) => p.chapter === c.key) ? [] : [first];
    });
    const hrefs = new Set([...kept, ...firsts].map((p) => p.href));
    return {
      id: team.id,
      name: team.name,
      hrefs: outline.pages.filter((p) => hrefs.has(p.href)).map((p) => p.href),
    };
  });
}

/** Where the screen at `href` falls in each team's pages. */
export const teamPlaces = (
  teams: readonly TeamPages[],
  href: string,
): {
  readonly id: string;
  readonly name: string;
  readonly at: number | null;
  readonly of: number;
}[] =>
  teams.map((t) => {
    const index = t.hrefs.indexOf(href);
    return { id: t.id, name: t.name, at: index === -1 ? null : index + 1, of: t.hrefs.length };
  });

/** The screens each team's lens leaves out, by team id. */
export const teamHidden = (
  outline: Outline,
  teams: readonly TeamPages[],
): Readonly<Record<string, readonly string[]>> =>
  Object.fromEntries(
    teams.map((t) => {
      const kept = new Set(t.hrefs);
      return [t.id, outline.pages.filter((p) => !kept.has(p.href)).map((p) => p.href)];
    }),
  );

/** The chapter, then the screen when it is not the chapter's only name. */
export function crumbOf(outline: Outline, page: Page): string[] {
  const chapter = outline.chapters.find((c) => c.key === page.chapter);
  if (chapter === undefined) return [page.title];
  const name = chapter.number === null ? chapter.title : `${chapter.number} · ${chapter.title}`;
  return page.title === chapter.title ? [name] : [name, page.title];
}
