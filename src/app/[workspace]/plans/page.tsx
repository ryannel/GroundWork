import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ModelTodayOverlays, TodaySearch } from '@/features/plan';
import { PlansPage, WorkspaceShell } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlanRows } from '@/infrastructure/model-plan-rows';
import { readModelWorkspaceNav } from '@/infrastructure/model-workspace-nav';
import { Callout } from '@/ui/callout';

interface Params {
  readonly workspace: string;
}

export const metadata: Metadata = { title: 'Plans' };

export default async function PlansRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const result = await readModelPlanRows(native);
  return (
    <WorkspaceShell
      workspace={native.model}
      title="Plans"
      nav={await readModelWorkspaceNav(native, { section: 'plans' })}
      actions={<TodaySearch />}
      overlays={<ModelTodayOverlays index={native} depth={1} />}
    >
      <PlansPage
        domains={native.model.domains.map(({ id: domainId, name }) => ({ id: domainId, name }))}
        rows={result.rows}
        programmes={result.programmes}
      />
      {result.gaps.length === 0 ? null : (
        <Callout title="Gaps in this plan list">
          <ul>
            {result.gaps.map((gap, at) => (
              <li key={`${gap.id}:${String(at)}`}>{gap.message}</li>
            ))}
          </ul>
        </Callout>
      )}
    </WorkspaceShell>
  );
}
