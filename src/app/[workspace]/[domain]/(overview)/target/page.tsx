import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { domainScopeOf } from '@/application/model-scope';
import { mapScopeOf } from '@/application/today-scope';
import { domainViewOf } from '@/application/workspace-domain';
import { targetViewOf } from '@/application/workspace-target';
import { TargetFlowView } from '@/features/plan';
import { DomainTab, DomainTarget } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// Where the domain is heading, as its people wrote it in target.yaml: the flow it aims for and the shifts from today.
export const metadata: Metadata = { title: 'Target architecture' };

export default async function DomainTargetRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  const scope = data === null ? null : domainScopeOf(data.workspace, domain);
  if (data === null || view === null || scope === null) notFound();
  const target = targetViewOf(data.today, domain, mapScopeOf(data.workspace, scope).places);
  return (
    <>
      <DomainTab
        says={`Where ${view.name} is heading: the flow it aims for, who should own each step, and how today differs.`}
        title="Target architecture"
        view={view}
      />
      <DomainTarget
        flow={target === null ? null : <TargetFlowView flow={target.flow} />}
        target={target}
      />
    </>
  );
}
