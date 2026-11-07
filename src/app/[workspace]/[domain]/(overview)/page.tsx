import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelDomainViewOf, modelDomainWordsOf } from '@/application/model-domain';
import { DomainOverview } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';
import { plural } from '@/shared/text';
import { Callout } from '@/ui/callout';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// The domain at a glance: each system, its edges, its busiest flows and its words.
// Named by its layout: a layout's title template reaches the pages below it, not the page beside it.
export const metadata: Metadata = {};

export default async function DomainRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const index = await readCanonicalModelIndex(id);
  if (index === null) notFound();
  const view = modelDomainViewOf(index, domain);
  if (view === null) notFound();
  return (
    <>
      <DomainOverview view={view} words={modelDomainWordsOf(index, domain)} />
      {view.gaps.length === 0 ? null : (
        <Callout title="What remains unknown">
          <p>{plural(view.gaps.length, 'recorded gap')} in this domain.</p>
          <p>{view.gaps[0]?.message}</p>
        </Callout>
      )}
    </>
  );
}
