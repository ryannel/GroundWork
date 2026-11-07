import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelDomainViewOf } from '@/application/model-domain';
import { modelFlowOf } from '@/application/model-flow';
import { ModelTodayFlow } from '@/features/plan';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// The domain's busiest flow, read first.
export const metadata: Metadata = { title: 'Flows' };

export default async function DomainFlowsRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const view = modelDomainViewOf(native, domain);
  if (view === null) notFound();
  const first = view.flows[0];
  const flow = first === undefined ? null : modelFlowOf(native, first.id);
  return flow === null ? (
    <p>No authored flow has a step in this domain yet.</p>
  ) : (
    <ModelTodayFlow flow={flow} />
  );
}
