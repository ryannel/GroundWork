import { planHref, type Outline, type Page } from '@/application/plan-pages';
import { NavRail } from '@/ui/nav-rail';

import { RailCut, type RailHidden } from './progress/rail-cut.client';
import { MarkRead, ReadCount, Tick } from './rail-marks.client';

// The plan as a story: each chapter opens to its screens, the current one already open. Reference and Versions
// sit apart, below the story. Each screen carries a mark: the one being read, the ones read before this session,
// and the rest. While reading as one team, the rail lists only that team's screens.
interface RailProps {
  readonly outline: Outline;
  readonly page: Page;
  /** The screens each team's lens leaves out of the rail. */
  readonly hidden?: RailHidden;
}

export function ChapterRail({ outline, page, hidden }: RailProps) {
  const plan = planHref(outline);
  return (
    <NavRail
      groups={outline.chapters.map((chapter) => ({
        key: chapter.key,
        marker: chapter.number ?? '◦',
        title: chapter.title,
        current: chapter.key === page.chapter,
        open: chapter.key === page.chapter,
        side: chapter.side,
        ...(chapter.number === null
          ? {}
          : {
              count: (
                <ReadCount
                  current={page.href}
                  hrefs={chapter.pages.map((p) => p.href)}
                  plan={plan}
                />
              ),
            }),
        items: chapter.pages.map((screen) => ({
          href: screen.href,
          title: screen.title,
          current: screen.href === page.href,
          mark: <Tick current={screen.href === page.href} href={screen.href} plan={plan} />,
        })),
      }))}
      label="Chapters"
    >
      <MarkRead href={page.href} plan={plan} />
      {hidden === undefined ? null : <RailCut hidden={hidden} />}
    </NavRail>
  );
}
