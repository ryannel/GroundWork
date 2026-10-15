import type { ReactNode } from 'react';

import type { Outline, Page } from '@/application/plan-pages';
import { InlineMarkdown } from '@/ui/markdown';
import { PageHeader } from '@/ui/page-header';
import { SectionHeading } from '@/ui/section-heading';

interface ScreenHeadProps {
  readonly outline: Outline;
  readonly page: Page;
  /** What is true on this screen, as the line under its name. */
  readonly headline?: string;
  /** On a screen that holds several things one tab at a time, the thing this head opens. */
  readonly item?: string | undefined;
  readonly children?: ReactNode;
}

// Every chapter screen opens the same way: its chapter, its name, then one line on what is true. Inside a tab,
// the head names the thing in the tab instead, under the screen's own.
export function ScreenHead({ outline, page, headline, item, children }: ScreenHeadProps) {
  if (item !== undefined) {
    return (
      <SectionHeading title={item}>
        {headline === undefined ? null : (
          <p>
            <InlineMarkdown text={headline} />
          </p>
        )}
        {children}
      </SectionHeading>
    );
  }
  return (
    <PageHeader
      description={headline === undefined ? undefined : <InlineMarkdown text={headline} />}
      title={page.title}
      trail={trailOf(outline, page)}
    >
      {children}
    </PageHeader>
  );
}

// The chapter is only worth a crumb from a screen deeper inside it.
function trailOf(outline: Outline, page: Page) {
  const chapter = outline.chapters.find((candidate) => candidate.key === page.chapter);
  const first = chapter?.pages[0];
  if (chapter === undefined || first === undefined || first.href === page.href) return [];
  return [{ label: chapter.title, href: first.href }];
}
