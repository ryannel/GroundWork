import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelSystemAt, modelSystemFlowOf } from '@/application/model-system';
import { ModelTodayFlow } from '@/features/plan';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { Callout } from '@/ui/callout';

interface Params {
  readonly workspace: string;
  readonly domain: string;
  readonly system: string;
}

// Named by its layout: a layout's title template reaches the pages below it, not the page beside it.
export const metadata: Metadata = {};

// The system's busiest flow, read first.
export default async function SystemRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain, system } = await params;
  const native = await readCanonicalModelIndex(id);
  if (native === null) notFound();
  const at = modelSystemAt(native, { domain, system });
  if (at === null) notFound();
  const flow = modelSystemFlowOf(native, { domain, system });
  return flow === null ? (
    <Callout title="No authored flow recorded">
      The overview keeps this system’s recorded components, interfaces, code and gaps visible.
    </Callout>
  ) : (
    <ModelTodayFlow flow={flow} />
  );
}
