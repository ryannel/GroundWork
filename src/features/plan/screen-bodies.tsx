import type { Model } from '@/application/plan/derive';
import type { BaseInfo } from '@/application/plan/plan-base';
import type { Outline, Page } from '@/application/plan-pages';
import type { VersionsData } from '@/application/plan-story-versions-data';
import type { StackCoverVM } from '@/application/workspace-work/stack-cover';
import type { SearchParams } from '@/shared/search-params';

export interface BodyProps {
  readonly model: Model;
  readonly outline: Outline;
  readonly page: Page;
  /** The plan's revisions, read for the versions chapter only. */
  readonly versions?: VersionsData | null;
  /** Where the plan's today comes from; the cover says so. */
  readonly base?: BaseInfo;
  /** The plans it reads after, overlaps and joins; the cover says so. */
  readonly stack?: StackCoverVM | null;
  /** The team the address cuts the page to (`?team=`), or null for everyone. */
  readonly lens?: string | null;
  readonly searchParams?: SearchParams;
}
