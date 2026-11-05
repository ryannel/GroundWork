import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { workspaceNavOf } from '@/application/workspace-nav';
import { partnersHref, workspaceHref } from '@/application/workspace-paths';
import { partnerPageVM } from '@/application/workspace-work/partner-page';
import { TodayOverlays, TodaySearch, WorkCard } from '@/features/plan';
import { PartnerPage, WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readWorkspacePlanIndex } from '@/infrastructure/workspace-plan-index';

interface Params {
  readonly workspace: string;
  readonly team: string;
}

/** A partner's page reads the team by its id without `team:`; only a team marked as a partner has one. */
async function partnerOf(workspace: string, team: string) {
  const index = await readWorkspacePlanIndex(workspace);
  const page = index === null ? null : partnerPageVM(index, `team:${team}`);
  return page?.team.partner === true ? page : null;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { workspace, team } = await params;
  const page = await partnerOf(workspace, team);
  return page === null ? {} : { title: page.team.name };
}

export default async function PartnerRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, team } = await params;
  const [data, page] = await Promise.all([todayData(id), partnerOf(id, team)]);
  if (data === null || page === null) notFound();
  const { workspace, today, plans } = data;
  const now = new Date();
  const cards = new Map(
    page.milestones
      .flatMap((group) => group.items)
      .map((card) => [
        card.key,
        <WorkCard card={card} key={card.key} today={now} workspace={id} />,
      ]),
  );
  return (
    <WorkspaceShell
      actions={<TodaySearch />}
      nav={workspaceNavOf(
        workspace,
        plans,
        { section: 'partners', today: today.model },
        data.programmes,
      )}
      overlays={<TodayOverlays depth={2} workspace={workspace} />}
      title={page.team.name}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: workspace.name, href: workspaceHref(workspace.id) },
        { label: 'Partners', href: partnersHref(workspace.id) },
      ]}
    >
      <PartnerPage cards={cards} page={page} today={now} />
    </WorkspaceShell>
  );
}
