import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { domainViewOf } from '@/application/workspace-domain';
import { FlowList } from '@/features/plan';
import { DomainTab } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

interface Props {
  readonly params: Promise<Params>;
  readonly children: ReactNode;
}

// Every flow with a step in the domain, as a list beside the one being read.
export default async function DomainFlowsLayout({ params, children }: Props) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  if (data === null || view === null) notFound();
  return (
    <>
      <DomainTab
        says={`The work that runs through ${view.name}, busiest first. Pick one to step through its drawing, or read it as a sequence.`}
        title="Flows"
        view={view}
      />
      <FlowList flows={view.flows}>{children}</FlowList>
    </>
  );
}
