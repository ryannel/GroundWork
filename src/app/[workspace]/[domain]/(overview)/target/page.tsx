import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelDomainViewOf } from '@/application/model-domain';
import { modelTargetOf } from '@/application/model-target';
import { TargetFlowView } from '@/features/plan';
import { DomainTab, DomainTarget } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// Where the domain is heading, as its people wrote it in target.yaml: the flow it aims for and the shifts from today.
export const metadata: Metadata = { title: 'Target architecture' };

export default async function DomainTargetRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const view = modelDomainViewOf(native, domain);
  if (view === null) notFound();
  const target = modelTargetOf(native, domain);
  return (
    <>
      <DomainTab
        says={`Where ${view.name} is heading: its authored target and shifts from today.`}
        title="Target architecture"
        view={view}
      />
      <DomainTarget
        target={target}
        flow={target === null ? null : <TargetFlowView flow={target.flow} />}
      />
    </>
  );
}
