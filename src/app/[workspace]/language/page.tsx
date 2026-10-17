import { notFound } from 'next/navigation';

import { languagePageOf } from '@/application/language-page';
import { workspaceNavOf } from '@/application/workspace-nav';
import { workspaceHref } from '@/application/workspace-paths';
import { TodayOverlays, TodaySearch } from '@/features/plan';
import { LanguageOverview, WorkspaceShell } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';
import { readWorkspaces } from '@/infrastructure/workspace-store';

interface Params {
  readonly workspace: string;
}

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Params[]> {
  const workspaces = await readWorkspaces();
  return workspaces.map(({ id }) => ({ workspace: id }));
}

export default async function LanguageRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id } = await params;
  const data = await todayData(id);
  if (data === null) notFound();
  const { workspace, today, plans } = data;
  return (
    <WorkspaceShell
      actions={<TodaySearch />}
      nav={workspaceNavOf(workspace, plans, { section: 'language', today: today.model })}
      overlays={<TodayOverlays depth={1} workspace={workspace} />}
      title="Language"
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: workspace.name, href: workspaceHref(workspace.id) },
      ]}
    >
      <LanguageOverview page={languagePageOf(workspace, today.languages, today.keyTerms)} />
    </WorkspaceShell>
  );
}
