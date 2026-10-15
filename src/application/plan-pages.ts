import type { Model } from '@/application/plan/derive';

import { screensFor, type ChapterKey } from './plan-pages-screens';

export type { ChapterKey } from './plan-pages-screens';

// A plan is read as a story: chapters, each of screens. The cover is the plan's own page; every other screen is
// /<workspace>/plans/<plan>/<chapter>/<screen>/. Reference and Versions sit beside the story, not in it.

export interface Page {
  readonly chapter: ChapterKey;
  readonly screen: string;
  readonly title: string;
  readonly href: string;
}

export interface Chapter {
  readonly key: ChapterKey;
  /** The number in the rail: 1 to 7 for the story, R and V beside it, null for the cover. */
  readonly number: string | null;
  readonly title: string;
  readonly subtitle: string;
  readonly side: boolean;
  readonly pages: readonly Page[];
}

export interface Outline {
  readonly workspace: string;
  readonly slug: string;
  readonly title: string;
  readonly chapters: readonly Chapter[];
  /** Every screen in reading order. */
  readonly pages: readonly Page[];
}

interface ChapterInfo {
  readonly key: ChapterKey;
  readonly number: string | null;
  readonly title: string;
  readonly subtitle: string;
}

const CHAPTERS: readonly ChapterInfo[] = [
  { key: 'cover', number: null, title: 'Cover', subtitle: 'What ships, for whom, why now' },
  { key: 'why', number: '1', title: 'Why', subtitle: 'The problem, with the evidence' },
  {
    key: 'today',
    number: '2',
    title: 'The system today',
    subtitle: 'Who owns what, who talks to whom',
  },
  {
    key: 'journey',
    number: '3',
    title: 'Journey',
    subtitle: 'How it runs today and with this plan',
  },
  {
    key: 'changes',
    number: '4',
    title: 'What changes',
    subtitle: 'Interfaces, records and migrations',
  },
  { key: 'prove', number: '5', title: 'How we prove it', subtitle: 'Why we can trust it' },
  {
    key: 'build',
    number: '6',
    title: 'How we build it',
    subtitle: 'Work items in build order, each with an owner',
  },
  {
    key: 'commit',
    number: '7',
    title: 'Decide and commit',
    subtitle: 'What the plan rests on, and what is still open',
  },
  { key: 'ref', number: 'R', title: 'Reference', subtitle: 'Look anything up' },
  {
    key: 'versions',
    number: 'V',
    title: 'Versions',
    subtitle: 'Every version, and whether to approve the next',
  },
];

const SIDE = new Set<ChapterKey>(['ref', 'versions']);

export interface PlanAddress {
  readonly workspace: string;
  readonly slug: string;
}

export function planHref({ workspace, slug }: PlanAddress): string {
  return `/${workspace}/plans/${slug}/`;
}

export function pageHref(at: PlanAddress, chapter: ChapterKey, screen: string): string {
  return chapter === 'cover' && screen === 'cover'
    ? planHref(at)
    : `${planHref(at)}${chapter}/${screen}/`;
}

function chapterOf(model: Model, info: ChapterInfo, at: PlanAddress): Chapter {
  const pages = screensFor(model, info.key).map((s): Page => ({
    chapter: info.key,
    screen: s.key,
    title: s.title,
    href: pageHref(at, info.key, s.key),
  }));
  return { ...info, side: SIDE.has(info.key), pages };
}

/** The story of a plan: its chapters that have screens, and all screens in reading order. */
export function outlineOf(model: Model, at: PlanAddress): Outline {
  const chapters = CHAPTERS.map((info) => chapterOf(model, info, at)).filter(
    (chapter) => chapter.pages.length > 0,
  );
  return {
    ...at,
    title: model.plan.meta.title,
    chapters,
    pages: chapters.flatMap((chapter) => chapter.pages),
  };
}

export function findPage(outline: Outline, chapter: string, screen: string): Page | null {
  return outline.pages.find((p) => p.chapter === chapter && p.screen === screen) ?? null;
}

export interface Neighbours {
  readonly previous: Page | null;
  readonly next: Page | null;
  /** The first screen of the chapter before and after this one. */
  readonly previousChapter: Page | null;
  readonly nextChapter: Page | null;
}

/** "Your part" reads one team's share, so it is reached from the cover's team links and the pager steps over it. */
const isPart = (p: Page): boolean => p.chapter === 'cover' && p.screen === 'part';

export function neighboursOf(outline: Outline, page: Page): Neighbours {
  const pages = outline.pages.filter((p) => p.href === page.href || !isPart(p));
  const at = pages.findIndex((p) => p.href === page.href);
  const chapters = outline.chapters;
  const c = chapters.findIndex((chapter) => chapter.key === page.chapter);
  return {
    previous: at > 0 ? (pages[at - 1] ?? null) : null,
    next: pages[at + 1] ?? null,
    previousChapter: c > 0 ? (chapters[c - 1]?.pages[0] ?? null) : null,
    nextChapter: chapters[c + 1]?.pages[0] ?? null,
  };
}

/** The `[chapter]/[screen]` segments of every screen except the cover itself, for the static routes. */
export function screenParams(outline: Outline): { chapter: string; screen: string }[] {
  return outline.pages
    .filter((p) => p.href !== planHref(outline))
    .map((p) => ({ chapter: p.chapter, screen: p.screen }));
}
