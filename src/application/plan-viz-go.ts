import type { Outline } from '@/application/plan-pages';

// Where a versioned endpoint or event's migration ladder is drawn: the changes chapter's page on retired interfaces.

export interface PageLink {
  readonly href: string;
  readonly label: string;
}

/** "See the ladder (4.2)": the page that draws the ladders, or null when the plan has none. */
export function ladderPage(outline: Outline): PageLink | null {
  const chapter = outline.chapters.find((c) => c.key === 'changes');
  const at = chapter?.pages.findIndex((p) => p.screen === 'contracts') ?? -1;
  const page = chapter?.pages[at];
  if (chapter === undefined || page === undefined) return null;
  return { href: page.href, label: `See the ladder (${chapter.number ?? ''}.${String(at + 1)})` };
}
