import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelWorkspaceNavOf } from '@/application/model-navigation';
import { modelValueFlowsOf } from '@/application/model-value-flows';
import { workspaceHref } from '@/application/workspace-paths';
import { ModelTodayOverlays, TodaySearch } from '@/features/plan';
import { ValueFlowsPage, WorkspaceShell } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlans } from '@/infrastructure/model-plans';

export const metadata: Metadata = { title: 'Value Flows' };

export default async function ValueFlowsRoute({
  params,
}: {
  readonly params: Promise<{ readonly workspace: string }>;
}) {
  const { workspace: id } = await params;
  const index = await readCanonicalModelIndex(id);
  if (index === null) notFound();
  return (
    <WorkspaceShell
      title="Value Flows"
      actions={<TodaySearch />}
      nav={modelWorkspaceNavOf(index, await readModelPlans(id), { section: 'value-flows' })}
      overlays={<ModelTodayOverlays index={index} depth={1} />}
      trail={[
        { label: 'Workspaces', href: '/' },
        { label: index.model.name, href: workspaceHref(id) },
      ]}
    >
      <ValueFlowsPage areas={modelValueFlowsOf(index)} />
    </WorkspaceShell>
  );
}
