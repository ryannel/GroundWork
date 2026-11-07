import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelDomainViewOf } from '@/application/model-domain';
import { modelFlowOf } from '@/application/model-flow';
import { flowSlug } from '@/application/workspace-paths';
import { ModelTodayFlow } from '@/features/plan';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';

interface Params {
  readonly workspace: string;
  readonly domain: string;
  readonly flow: string;
}
async function domainFlowAt(at: Params) {
  const index = await readCanonicalModelIndex(at.workspace);
  const selected =
    index === null
      ? undefined
      : modelDomainViewOf(index, at.domain)?.flows.find((item) => flowSlug(item.id) === at.flow);
  return { index, selected };
}
export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const { selected } = await domainFlowAt(await params);
  return { title: selected?.name ?? 'Flows' };
}
export default async function DomainFlowRoute({ params }: { readonly params: Promise<Params> }) {
  const { index, selected } = await domainFlowAt(await params);
  const flow = index === null || selected === undefined ? null : modelFlowOf(index, selected.id);
  if (flow === null) notFound();
  return <ModelTodayFlow flow={flow} />;
}
