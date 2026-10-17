import type { PlanRow } from '@/application/plan-index';
import { plural } from '@/shared/text';
import { Callout } from '@/ui/callout';
import { PageHeader } from '@/ui/page-header';

import { PlansIndex, type IndexDomain } from './plans-index.client';

interface PlansPageProps {
  readonly rows: readonly PlanRow[];
  readonly domains: readonly IndexDomain[];
}

// What may change in the workspace: every plan, each showing its own picture of the systems after it lands.
export function PlansPage({ rows, domains }: PlansPageProps) {
  const open = rows.filter((row) => row.stage !== 'done').length;
  return (
    <>
      <PageHeader
        description="What may change. Each plan shows its own picture of the systems after it lands."
        meta={`${plural(rows.length, 'plan')}, ${String(open)} not yet delivered`}
        title="Plans"
      />
      {rows.length === 0 ? (
        <Callout title="No plans yet">
          <p>
            Ask an agent to plan a change with the <code>groundwork-plan</code> skill. Each plan
            lives in the workspace&apos;s repo as <code>plans/&lt;plan&gt;/plan.yaml</code>.
          </p>
        </Callout>
      ) : (
        <PlansIndex domains={domains} rows={rows} />
      )}
    </>
  );
}
