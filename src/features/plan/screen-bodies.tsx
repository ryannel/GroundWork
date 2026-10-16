import type { ReactNode } from 'react';

import type { Model } from '@/application/plan/derive';
import type { BaseInfo } from '@/application/plan/plan-base';
import type { ChapterKey, Outline, Page } from '@/application/plan-pages';
import type { VersionsData } from '@/application/plan-story-versions-data';

import { BuildChapter } from './chapters/build/build-chapter';
import { ChangesChapter } from './chapters/changes/changes-chapter';
import { CommitChapter } from './chapters/commit/commit-chapter';
import { CoverChapter } from './chapters/cover/cover-chapter';
import { JourneyChapter } from './chapters/journey/journey-chapter';
import { ProveChapter } from './chapters/prove/prove-chapter';
import { RefChapter } from './chapters/ref/ref-chapter';
import { TodayChapter } from './chapters/today/today-chapter';
import { VersionsChapter } from './chapters/versions/versions-chapter';
import { WhyChapter } from './chapters/why/why-chapter';

export interface BodyProps {
  readonly model: Model;
  readonly outline: Outline;
  readonly page: Page;
  /** The plan's revisions, read for the versions chapter only. */
  readonly versions?: VersionsData | null;
  /** Where the plan's today comes from; the cover says so. */
  readonly base?: BaseInfo;
}

type Body = (props: BodyProps) => ReactNode;

// The one place that says what draws each chapter's screens: a component that picks on props.page.screen.
export const BODIES: Readonly<Record<ChapterKey, Body>> = {
  cover: CoverChapter,
  why: WhyChapter,
  today: TodayChapter,
  journey: JourneyChapter,
  changes: ChangesChapter,
  prove: ProveChapter,
  build: BuildChapter,
  commit: CommitChapter,
  ref: RefChapter,
  versions: VersionsChapter,
};
