import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelSystemFlowOf } from '@/application/model-system';
import { ModelTodayFlow } from '@/features/plan';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';

interface Params {
  readonly workspace: string;
  readonly domain: string;
  readonly system: string;
  readonly flow: string;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<Params>;
}): Promise<Metadata> {
  const at = await params;
  const native = await readCanonicalModelIndex(at.workspace);
  if (native === null) return { title: 'Flows' };
  return { title: modelSystemFlowOf(native, at, at.flow)?.name ?? 'Flows' };
}

// One flow through the system, beside the list of all of them.
export default async function SystemFlowRoute({ params }: { readonly params: Promise<Params> }) {
  const at = await params;
  const native = await readCanonicalModelIndex(at.workspace);
  if (native === null) notFound();
  const flow = modelSystemFlowOf(native, at, at.flow);
  if (flow === null) notFound();
  return <ModelTodayFlow flow={flow} />;
}
