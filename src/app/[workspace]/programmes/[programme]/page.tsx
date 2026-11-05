import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { planRowsOf } from '@/application/plan-index';
import { workspaceNavOf } from '@/application/workspace-nav';
import { programmesHref, workspaceHref } from '@/application/workspace-paths';
import { landingOf, programmePageVM } from '@/application/workspace-work/programme-page';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { ProgrammePage, WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readWorkspacePlanIndex } from '@/infrastructure/workspace-plan-index';
import { readLoadedPlans } from '@/infrastructure/workspace-plans';

interface Params {
  readonly workspace: string;
  readonly programme: string;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { workspace, programme } = await params;
  const index = await readWorkspacePlanIndex(workspace);
  const found = index?.programmes.get(programme);
  return found === undefined ? {} : { title: found.title };
}

export default async function ProgrammeRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, programme } = await params;
  const [data, index] = await Promise.all([todayData(id), readWorkspacePlanIndex(id)]);
  const page = index === null ? null : programmePageVM(index, programme);
  if (data === null || page === null) notFound();
  const { workspace, today, plans } = data;
  const rows = planRowsOf(workspace, await readLoadedPlans(workspace.id));
  const landing = landingOf(
    workspace.id,
    page.plans.map((p) => p.slug),
    rows,
    workspace.domains,
  );
  return (
    <WorkspaceShell
      actions={<TodaySearch />}
      nav={workspaceNavOf(
        workspace,
        plans,
        { section: 'programmes', today: today.model },
        data.programmes,
      )}
      overlays={<TodayOverlays depth={2} workspace={workspace} />}
      title={page.programme.title}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: workspace.name, href: workspaceHref(workspace.id) },
        { label: 'Programmes', href: programmesHref(workspace.id) },
      ]}
    >
      <ProgrammePage landing={landing} page={page} today={new Date()} />
    </WorkspaceShell>
  );
}
