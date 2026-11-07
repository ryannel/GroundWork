import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelDomainViewOf } from '@/application/model-domain';
import { DomainPlans, DomainTab } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { readModelPlanRows } from '@/infrastructure/model-plan-rows';
import { Callout } from '@/ui/callout';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// The plans that reach the domain, read like the workspace's Plans page but narrowed to the domain: search them,
// cut them by stage, and see which other domains each one also lands in.
export const metadata: Metadata = { title: 'Plans' };

export default async function DomainPlansRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const view = modelDomainViewOf(native, domain);
  if (view === null) notFound();
  const result = await readModelPlanRows(native);
  return (
    <>
      <DomainTab
        says={`The plans that change a system in ${view.name}, and their recorded progress.`}
        title="Plans"
        view={view}
      />
      <DomainPlans
        domains={native.model.domains.map(({ id: domainId, name }) => ({ id: domainId, name }))}
        here={view.domainId}
        rows={result.rows.filter((row) => row.domains.includes(view.domainId))}
      />
      {result.gaps.length === 0 ? null : (
        <Callout title="Plan locations or progress remain unknown">
          <ul>
            {result.gaps.map((gap, at) => (
              <li key={`${gap.id}:${String(at)}`}>{gap.message}</li>
            ))}
          </ul>
        </Callout>
      )}
    </>
  );
}
