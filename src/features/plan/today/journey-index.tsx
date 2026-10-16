import type { Model } from '@/application/plan/derive';
import { journeyIndexOf } from '@/application/today-journey-index';
import { journeysHeadline, todayJourneysOf } from '@/application/today-journeys';
import type { Workspace } from '@/domain/workspace';
import { PageHeader } from '@/ui/page-header';

import { JourneyFinder } from './journey-finder.client';
import styles from './journey-index.module.css';

interface TodayJourneysProps {
  readonly workspace: Workspace;
  readonly model: Model;
}

/** Every journey through the workspace today, as a list to search: user journeys first, then flows by stage. */
export function TodayJourneys({ workspace, model }: TodayJourneysProps) {
  const index = journeyIndexOf(workspace, model);
  return (
    <>
      <PageHeader description={journeysHeadline(todayJourneysOf(model))} title="Journeys">
        <p>
          Find one by its name, who starts it or a system it crosses, or narrow to one domain. Open
          one to walk it a step at a time.
        </p>
      </PageHeader>
      {index.total === 0 ? (
        <p className={styles.empty}>No journeys or flows are recorded for this workspace yet.</p>
      ) : (
        <JourneyFinder index={index} />
      )}
    </>
  );
}
