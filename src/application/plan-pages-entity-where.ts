import type { Model } from '@/application/plan/derive';
import { prop, typeOf } from '@/application/plan/ids';
import type { ChapterKey, Outline } from '@/application/plan-pages';
import type { EntityType } from '@/domain/plan/plan-ids';
import type { Chapter as StoryChapter } from '@/domain/plan/plan-vocab';

// Where a thing turns up: the chapters of the story that tell it, its Reference catalogue, and the plan prose that
// cites it, resolved to the decision, risk or scenario that holds the words.

export interface EntityPlace {
  /** "3 · Journey". */
  readonly label: string;
  /** The screen it opens, such as "Components". */
  readonly title: string;
  readonly href: string;
}

const STORY_PAGES: Readonly<Record<StoryChapter, ChapterKey>> = {
  why: 'why',
  today: 'today',
  runs: 'journey',
  new: 'journey',
  changes: 'changes',
  prove: 'prove',
  build: 'build',
  commit: 'commit',
};

const CATALOGUE: Partial<Readonly<Record<EntityType, string>>> = {
  service: 'services',
  store: 'stores',
  interface: 'apis',
  endpoint: 'apis',
  schema: 'schemas',
  field: 'schemas',
  message: 'events',
  flow: 'flows',
  step: 'flows',
  screen: 'screens',
  region: 'screens',
  change: 'ledger',
  test: 'tests',
  workItem: 'work',
  milestone: 'milestones',
  risk: 'risks',
  team: 'teams',
  decision: 'decisions',
  operation: 'operations',
};

/** The Reference screen that lists things of the id's kind, or undefined. */
export function catalogueOf(id: string): string | undefined {
  const type = typeOf(id);
  return type === null ? undefined : CATALOGUE[type];
}

const labelOf = (number: string | null, title: string): string =>
  number === null ? title : `${number} · ${title}`;

/** The chapters that tell the thing, each opened at its first screen, and its Reference catalogue. */
export function placesOf(model: Model, outline: Outline, id: string): EntityPlace[] {
  const keys = new Set(model.storyRefs(id).map((chapter) => STORY_PAGES[chapter]));
  const story = outline.chapters
    .filter((chapter) => keys.has(chapter.key))
    .flatMap((chapter) => {
      const page = chapter.pages[0];
      return page === undefined
        ? []
        : [{ label: labelOf(chapter.number, chapter.title), title: page.title, href: page.href }];
    });
  const screen = catalogueOf(id);
  const ref = outline.chapters.find((chapter) => chapter.key === 'ref');
  const page = ref?.pages.find((p) => p.screen === screen);
  return ref === undefined || page === undefined
    ? story
    : [...story, { label: labelOf(ref.number, ref.title), title: page.title, href: page.href }];
}

const SEGMENT = /[^.[\]]+/gu;

/** The deepest thing with an id along a plan path ("decisions[3].context" is that decision), or null. */
function holderOf(plan: unknown, path: string): string | null {
  let at: unknown = plan;
  let hit: string | null = null;
  for (const [segment] of path.matchAll(SEGMENT)) {
    at = Array.isArray(at) ? at[Number(segment)] : prop(at, segment);
    if (at === undefined || at === null) break;
    const id = prop(at, 'id');
    if (typeof id === 'string' && typeOf(id) !== null) hit = id;
  }
  return hit;
}

export interface Mentions {
  /** The things whose prose cites it. */
  readonly ids: readonly string[];
  /** Parts of the plan with no id of their own that cite it ("problem", "meta"). */
  readonly parts: readonly string[];
}

/** The plan prose that cites a thing, as the things that hold the words. */
export function mentionsOf(model: Model, id: string): Mentions {
  const ids = new Set<string>();
  const parts = new Set<string>();
  for (const path of model.inverse(id).citedBy) {
    const holder = holderOf(model.plan, path);
    if (holder === null) parts.add((/^[^.[]+/u.exec(path)?.[0] ?? path).replaceAll('_', ' '));
    else if (holder !== id) ids.add(holder);
  }
  return { ids: [...ids], parts: [...parts] };
}
