import { notFound } from 'next/navigation';

import { domainScopeOf } from '@/application/model-scope';
import { domainViewOf } from '@/application/workspace-domain';
import { targetViewOf } from '@/application/workspace-target';
import { TargetMap } from '@/features/plan';
import { DomainTab, DomainTarget } from '@/features/workspace';
import { todayData } from '@/infrastructure/today-data';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// Where the domain is heading, as its people wrote it in target.yaml: the flow it aims for and the shifts from today.
export default async function DomainTargetRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const data = await todayData(id);
  const view = data === null ? null : domainViewOf(data.workspace, data.today.model, domain);
  const scope = data === null ? null : domainScopeOf(data.workspace, domain);
  if (data === null || view === null || scope === null) notFound();
  const target = data.today.targets.find((each) => each.domain === domain);
  return (
    <>
      <DomainTab
        says={`Where ${view.name} is heading: the flow it aims for, who should own each step, and how today differs.`}
        title="Target architecture"
        view={view}
      />
      <DomainTarget
        map={
          target === undefined ? undefined : (
            <TargetMap
              model={data.today.model}
              scope={scope}
              target={target}
              workspace={data.workspace}
            />
          )
        }
        target={targetViewOf(data.today, domain)}
      />
    </>
  );
}
