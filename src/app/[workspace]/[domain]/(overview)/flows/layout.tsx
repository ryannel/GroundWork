import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { modelDomainViewOf } from '@/application/model-domain';
import { FlowList } from '@/features/plan';
import { DomainTab } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';

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
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const view = modelDomainViewOf(native, domain);
  if (view === null) notFound();
  return (
    <>
      <DomainTab
        says={`The authored narratives through ${view.name}. Entry flows show recorded implementation detail.`}
        title="Flows"
        view={view}
      />
      <FlowList flows={view.flows}>{children}</FlowList>
    </>
  );
}
