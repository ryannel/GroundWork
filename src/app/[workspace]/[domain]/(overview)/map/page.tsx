import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { modelDomainViewOf } from '@/application/model-domain';
import { modelSystemMapWire } from '@/application/model-system-map-input';
import { SystemMapView } from '@/features/plan';
import { DomainTab } from '@/features/workspace';
import { readCanonicalModelIndex } from '@/infrastructure/model-index';

interface Params {
  readonly workspace: string;
  readonly domain: string;
}

// Every component in the domain, grouped by system, with the components one step outside.
export const metadata: Metadata = { title: 'Map' };

export default async function DomainMapRoute({ params }: { readonly params: Promise<Params> }) {
  const { workspace: id, domain } = await params;
  const index = await readCanonicalModelIndex(id);
  if (index === null) notFound();
  const view = modelDomainViewOf(index, domain);
  if (view === null) notFound();
  return (
    <>
      <DomainTab
        says={`How the systems of ${view.name} work together. Unfold a system for its parts; dotted cards sit outside it, one step away.`}
        title="Map"
        view={view}
      />
      <SystemMapView
        packed={modelSystemMapWire(index, { focus: [view.domainId] })}
        outside="outside this domain, one step away"
      />
    </>
  );
}
